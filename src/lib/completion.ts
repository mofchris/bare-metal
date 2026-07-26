// Progress at every level, and an honest finish date (D-039).
// Depends on: curriculum.ts, gating.ts, progress-store.ts, study-time.ts.
// Depended on by: components/home.tsx, components/panels.tsx.
//
// WHY THIS SHAPE. Christopher asked for progress per lesson, per module and
// for the whole thing, plus a projected finish date, and asked me to look up
// what actually motivates rather than guess. The research is consistent on two
// points: a visible progress bar is the single strongest motivating element in
// a learning app — ahead of points and badges — and several near goals beat one
// distant goal. So this module computes progress at three scales rather than
// one, and the app shows all three.
//
// It deliberately does NOT do points, badges or levels. Those are weaker in the
// literature, and self-determination theory explains why: what motivates is
// feedback that signals growing COMPETENCE, which "43% of the curriculum" and
// "you average 38 minutes a day" both are, and which a badge is not.
//
// THE ESTIMATE IS DERIVED FROM HIS OWN HISTORY, never from an invented
// constant, and it returns null rather than a number when there is too little
// history to be honest. A made-up finish date is worse than no finish date: he
// would plan against it.

import type { Curriculum } from "./curriculum";
import { lessonPassed } from "./gating";
import type { LessonProgressRecord } from "./progress-store";
import { secondsByDay, type StudyTimeRecord } from "./study-time";

/** Lessons passed against lessons that exist. */
export interface CurriculumProgress {
  passed: number;
  total: number;
  /** 0–100, rounded, from `passed` — the headline number. */
  pct: number;
  /**
   * Lesson-equivalents completed INCLUDING partial reading, so 2 passed plus a
   * lesson read halfway counts as 2.4. The headline stays whole lessons
   * because "2/44 passed" is what he has actually earned, but the pace
   * estimate uses this: without it the projection cannot move between passes,
   * which is exactly the staleness Christopher noticed — a week of reading
   * would leave the finish date untouched.
   */
  effective: number;
}

export function curriculumProgress(
  curriculum: Curriculum,
  statuses: ReadonlyMap<string, LessonProgressRecord>,
  readFractions: ReadonlyMap<string, number> = new Map(),
): CurriculumProgress {
  const lessons = curriculum.modules.flatMap((m) => m.lessons);
  const passed = lessons.filter((l) => lessonPassed(statuses.get(l.id))).length;
  const effective = lessons.reduce(
    (sum, l) =>
      sum + lessonProgressFraction(statuses.get(l.id), readFractions.get(l.id) ?? null),
    0,
  );
  const total = lessons.length;
  return {
    passed,
    total,
    pct: total === 0 ? 0 : Math.round((passed / total) * 100),
    effective,
  };
}

/**
 * How much history is needed before a finish date is worth showing. Two
 * lessons gives a rate; three separate study days gives some idea of how often
 * he actually sits down. Below that the projection would swing wildly between
 * sessions, which reads as the app guessing — and it would be.
 */
export const MIN_LESSONS_FOR_ESTIMATE = 2;
export const MIN_ACTIVE_DAYS_FOR_ESTIMATE = 3;

export interface PaceEstimate {
  /** Minutes of study per lesson passed, measured. Reported, not a driver —
      see the note on what actually moves the date. */
  minutesPerLesson: number;
  /** Average minutes on days he actually studied. Reported, not a driver. */
  minutesPerActiveDay: number;
  /** Lessons finished per day studied. THIS is what moves the date. */
  lessonsPerActiveDay: number;
  /** Days he has actually studied on. */
  activeDays: number;
  /** Fraction of elapsed days he studied at all, 0–1. */
  studyFrequency: number;
  /** Calendar days until the curriculum is finished at this pace. */
  daysRemaining: number;
  /** The projected date. */
  finishDate: Date;
}

/**
 * Project a finish date from measured pace, or null when there is not enough
 * history to say anything honest.
 *
 * The calculation deliberately separates two different things his time data
 * contains: how fast he moves when studying, and how often he studies. Assuming
 * he studies every day would flatter the estimate; using only elapsed days
 * would punish a deliberate rest day. Multiplying the two is the honest middle.
 *
 * WHAT ACTUALLY MOVES THE DATE, because the first version of the UI copy got
 * this wrong. Work the algebra through: minutes per lesson is T/P and minutes
 * per active day is T/A, so days needed is R x (T/P) / (T/A) = R x A / P. The
 * total minutes T CANCELS. Sitting in the app longer therefore changes nothing
 * on its own — only finishing lessons (raising P) and studying on more days
 * (raising frequency) do. That is the right behaviour for a projection, since
 * minutes spent without progress are not evidence of progress, but the UI must
 * not imply otherwise.
 */
export function paceEstimate(
  progress: CurriculumProgress,
  studyTime: readonly StudyTimeRecord[],
  now: Date,
): PaceEstimate | null {
  if (progress.passed < MIN_LESSONS_FOR_ESTIMATE) return null;
  // Rate and remaining work both use the FRACTIONAL figure, so finishing a
  // lesson is not the only event that can move the date — reading moves it too.
  const done = Math.max(progress.effective, progress.passed);
  const remainingLessons = progress.total - done;
  if (remainingLessons <= 0) return null;

  const byDay = secondsByDay(studyTime);
  const activeDays = [...byDay.entries()].filter(([, seconds]) => seconds > 0);
  if (activeDays.length < MIN_ACTIVE_DAYS_FOR_ESTIMATE) return null;

  const totalMinutes = activeDays.reduce((sum, [, s]) => sum + s, 0) / 60;
  if (totalMinutes <= 0) return null;

  const minutesPerLesson = totalMinutes / done;
  const minutesPerActiveDay = totalMinutes / activeDays.length;

  // How often he sits down, measured from his first study day to today.
  const days = activeDays.map(([day]) => day).sort();
  const firstDay = new Date(`${days[0]!}T00:00:00`);
  const elapsedDays = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - firstDay.getTime()) / DAY_MS) + 1,
  );
  const studyFrequency = Math.min(1, activeDays.length / elapsedDays);

  const activeDaysNeeded = (remainingLessons * minutesPerLesson) / minutesPerActiveDay;
  const daysRemaining = Math.ceil(activeDaysNeeded / studyFrequency);

  const finishDate = new Date(startOfDay(now).getTime() + daysRemaining * DAY_MS);
  return {
    minutesPerLesson: Math.round(minutesPerLesson),
    minutesPerActiveDay: Math.round(minutesPerActiveDay),
    lessonsPerActiveDay: done / activeDays.length,
    activeDays: activeDays.length,
    studyFrequency,
    daysRemaining,
    finishDate,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * How far through a single lesson he is, as 0–1: reading counts for something
 * even before the quiz is passed, because a lesson half-read is genuinely half
 * done and showing it as zero is the discouraging lie the research warns about.
 * A passed lesson is always 1, whatever the saved scroll position says.
 */
export function lessonProgressFraction(
  record: LessonProgressRecord | undefined,
  readFraction: number | null,
): number {
  if (lessonPassed(record)) return 1;
  // Reading the whole lesson without passing the quiz caps at 0.8: the quiz is
  // the remaining fifth, and showing 100% for unfinished work would be false.
  return Math.min(0.8, Math.max(0, readFraction ?? 0) * 0.8);
}
