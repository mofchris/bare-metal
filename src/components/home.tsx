// Home: the dashboard-first landing. A data-driven hero (or a start-here
// push when there's no history yet), the module map with its via rail, and a
// side rail of progress panels. Depends on: lib/curriculum, lib/route,
// lib/lookup, lib/srs, lib/stats, lib/backup, lib/progress-store,
// components/panels. Depended on by: app.tsx.
//
// Every hero state pushes ONE next action: start (no history), review (cards
// due), or continue (next unfinished lesson). The user should never have to
// decide what studying means today.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum, Lesson, Module } from "../lib/curriculum";
import { examHref, lessonHref, quizHref } from "../lib/route";
import { questionCountFor } from "../lib/lookup";
import { dueQuestionIds, nextDueAt } from "../lib/srs";
import { exportReminder, type ReminderState } from "../lib/backup";
import {
  examUnlocked,
  lessonPassed,
  lessonUnlocked,
  moduleUnlocked,
  passedLessonCount,
  PASS_MARK,
} from "../lib/gating";
import { localDateKey, masteryByLesson, runHistory, weakestLessons } from "../lib/stats";
import { studyStreak, type StudyTimeRecord } from "../lib/study-time";
import type {
  AttemptRecord,
  ExamResultRecord,
  LessonProgressRecord,
  ProgressDb,
} from "../lib/progress-store";
import { RunTrend, StreakCalendar, WeakestAreas } from "./panels";

interface ProgressData {
  statuses: Map<string, LessonProgressRecord>;
  exams: Map<string, ExamResultRecord>;
  attempts: AttemptRecord[];
  studyTime: StudyTimeRecord[];
  due: number;
  nextDue: string | null;
  reminder: ReminderState;
}

const attemptDaysOf = (attempts: AttemptRecord[]): Set<string> =>
  new Set(attempts.map((a) => localDateKey(new Date(a.at))));

export function Home({
  curriculum,
  db,
}: {
  curriculum: Curriculum;
  db: ProgressDb | null;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    Promise.all([
      db.lessonStatuses(),
      db.examResults(),
      db.allAttempts(),
      db.allStudyTime(),
      db.allSrsStates(),
      db.getMeta("lastExportAt"),
    ])
      .then(([statuses, exams, attempts, studyTime, srs, lastExportAt]) => {
        const now = new Date();
        setData({
          statuses,
          exams,
          attempts,
          studyTime,
          due: dueQuestionIds(srs, now).length,
          nextDue: nextDueAt(srs, now),
          reminder: exportReminder(lastExportAt ?? null, attempts.length > 0, now),
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [db]);

  const statuses = data?.statuses ?? new Map<string, LessonProgressRecord>();
  const exams = data?.exams ?? new Map<string, ExamResultRecord>();
  const lessons = curriculum.modules.flatMap((m) => m.lessons);
  const doneCount = lessons.filter((l) => lessonPassed(statuses.get(l.id))).length;
  // The next actionable lesson: first unlocked, un-passed lesson in an
  // unlocked module (gating-aware, D-023).
  const continueLesson = curriculum.modules
    .filter((m) => moduleUnlocked(m, exams))
    .flatMap((m) =>
      m.lessons.filter(
        (l) => lessonUnlocked(m, l.id, statuses) && !lessonPassed(statuses.get(l.id)),
      ),
    )[0];

  return (
    <div>
      {error && <p class="warn-banner">Couldn't read progress records: {error}</p>}
      {data?.reminder.overdue && (
        <p class="warn-banner">
          {data.reminder.daysSinceExport === null
            ? "Your progress has never been backed up on this device."
            : `Last backup was ${data.reminder.daysSinceExport} days ago.`}{" "}
          Browser storage can be wiped without warning:{" "}
          <a href="#/backup">export a backup file</a>.
        </p>
      )}

      <Hero
        curriculum={curriculum}
        data={data}
        doneCount={doneCount}
        totalLessons={lessons.length}
        continueLesson={continueLesson}
      />

      <div class="home-grid">
        <section class="home-modules rise" style={{ animationDelay: "90ms" }}>
          {curriculum.modules.map((module) => (
            <ModuleBlock
              key={module.id}
              module={module}
              statuses={statuses}
              exams={exams}
              unlocked={moduleUnlocked(module, exams)}
              prereqTitles={module.prereqs.map(
                (p) =>
                  (curriculum.modules.find((m) => m.id === p)?.title ?? p).split(":")[0]!,
              )}
            />
          ))}
        </section>

        <aside class="home-rail rise" style={{ animationDelay: "180ms" }}>
          <section>
            <h3 class="dash-section">Study streak</h3>
            <StreakCalendar
              records={data?.studyTime ?? []}
              attemptDays={attemptDaysOf(data?.attempts ?? [])}
              now={new Date()}
            />
            {data && data.due === 0 && data.nextDue && (
              <p class="rail-note">
                Reviews up to date. Next: {new Date(data.nextDue).toLocaleDateString()}
              </p>
            )}
          </section>
          {(!data || data.attempts.length === 0) && <HowItWorks />}
          {data && <RunTrend runs={runHistory(data.attempts, 10)} />}
          {data && (
            <WeakestAreas
              weakest={weakestLessons(masteryByLesson(curriculum, data.attempts), 3)}
            />
          )}
          {data && data.attempts.length > 0 && (
            <section>
              <h3 class="dash-section">Backup</h3>
              <p class="rail-note">
                {data.reminder.daysSinceExport === null
                  ? "Never exported on this device."
                  : `Last export ${data.reminder.daysSinceExport} day${data.reminder.daysSinceExport === 1 ? "" : "s"} ago.`}{" "}
                <a href="#/backup">Export</a>
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/* One module: header with progress bar, gated lesson rows, exam row. */
function ModuleBlock({
  module,
  statuses,
  exams,
  unlocked,
  prereqTitles,
}: {
  module: Module;
  statuses: Map<string, LessonProgressRecord>;
  exams: Map<string, ExamResultRecord>;
  unlocked: boolean;
  prereqTitles: string[];
}) {
  const passed = passedLessonCount(module, statuses);
  const exam = exams.get(module.id);
  const examOpen = unlocked && examUnlocked(module, statuses);

  return (
    <section class={unlocked ? "module-block" : "module-block locked"}>
      <div class="module-head">
        <h2>{module.title}</h2>
        <span class="lesson-meta">
          {passed}/{module.lessons.length} passed
        </span>
      </div>
      <div
        class="module-progress"
        role="img"
        aria-label={`${passed} of ${module.lessons.length} lessons passed`}
      >
        <span
          class="module-progress-fill"
          style={{ width: `${(passed / module.lessons.length) * 100}%` }}
        />
      </div>

      {!unlocked ? (
        <p class="module-locked-note">
          Locked. Pass the {prereqTitles.join(" and ")} exam ({PASS_MARK}%) to open this
          module.
        </p>
      ) : (
        <>
          <ul class="lesson-list">
            {module.lessons.map((lesson) => {
              const questions = questionCountFor(module, lesson.id);
              const record = statuses.get(lesson.id);
              const open = lessonUnlocked(module, lesson.id, statuses);
              const cls = lessonPassed(record)
                ? "done"
                : record?.status === "in-progress" || record?.status === "done"
                  ? "started"
                  : "";
              return (
                <li key={lesson.id} class={open ? cls : "locked-lesson"}>
                  {open ? (
                    <a href={lessonHref(lesson.id)}>{lesson.title}</a>
                  ) : (
                    <span
                      class="locked-title"
                      title={`Score ${PASS_MARK}% on the previous lesson's quiz to open`}
                    >
                      {lesson.title}
                    </span>
                  )}
                  <span class="lesson-meta">
                    {record?.bestScorePct !== undefined &&
                      `best ${record.bestScorePct}% · `}
                    {open
                      ? questions > 0
                        ? `${questions} questions`
                        : "no questions yet"
                      : `needs ${PASS_MARK}% on previous`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p class="exam-row">
            {exam?.passed ? (
              <>
                <a href={examHref(module.id)}>Module exam</a>
                <span class="lesson-meta badge-done">
                  passed · best {exam.bestScorePct}%
                </span>
              </>
            ) : examOpen ? (
              <>
                <a href={examHref(module.id)}>
                  Module exam · all {module.questions.length} questions
                </a>
                <span class="lesson-meta">
                  {exam ? `best ${exam.bestScorePct}% · ` : ""}pass {PASS_MARK}% to unlock
                  the next module
                </span>
              </>
            ) : (
              <>
                <span class="locked-title">Module exam</span>
                <span class="lesson-meta">opens when every lesson is passed</span>
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}

/* The hero pushes exactly one action, chosen from the data. */
function Hero({
  curriculum,
  data,
  doneCount,
  totalLessons,
  continueLesson,
}: {
  curriculum: Curriculum;
  data: ProgressData | null;
  doneCount: number;
  totalLessons: number;
  continueLesson: Lesson | undefined;
}) {
  const questionTotal = curriculum.modules.reduce((n, m) => n + m.questions.length, 0);

  // Fresh device: sell the loop once, then push lesson 1.
  if (!data || data.attempts.length === 0) {
    const first = curriculum.modules[0]?.lessons[0];
    return (
      <section class="hero rise">
        <TraceDecor />
        <p class="hero-eyebrow">Machine Learning Systems · self-study</p>
        <h2 class="hero-title">Learn the metal under the models.</h2>
        <p class="hero-sub">
          {totalLessons} sourced lessons across {curriculum.modules.length} modules,{" "}
          {questionTotal} quiz questions that come back on a spaced schedule. Works
          offline, keeps score honestly.
        </p>
        {first && (
          <p class="hero-actions">
            <a class="btn btn-lg" href={lessonHref(first.id)}>
              Start lesson 1: {first.title}
            </a>
          </p>
        )}
      </section>
    );
  }

  const { attempts, due } = data;
  const now = new Date();
  const streak = {
    currentStreak: studyStreak(data.studyTime, attemptDaysOf(attempts), now).current,
  };
  // A finished module whose exam hasn't been passed outranks "continue".
  const pendingExam = curriculum.modules.find(
    (m) =>
      moduleUnlocked(m, data.exams) &&
      examUnlocked(m, data.statuses) &&
      data.exams.get(m.id)?.passed !== true,
  );
  const mastery = masteryByLesson(curriculum, attempts).filter((m) => m.attempted > 0);
  const known = mastery.reduce((n, m) => n + m.mastered, 0);
  const tracked = mastery.reduce((n, m) => n + m.attempted, 0);
  const pct = tracked > 0 ? Math.round((known / tracked) * 100) : 0;

  return (
    <section class="hero rise">
      <TraceDecor />
      <p class="hero-eyebrow">
        {streak.currentStreak > 0
          ? `Day ${streak.currentStreak} of the streak`
          : "The streak starts today"}
      </p>
      <h2 class="hero-title hero-title-data">
        <span class="hero-figure">{pct}%</span> of what you've met,
        <br />
        you currently know.
      </h2>
      <p class="hero-sub">
        {tracked} questions tracked · {doneCount}/{totalLessons} lessons done
        {due === 0 && data.nextDue
          ? ` · next review ${new Date(data.nextDue).toLocaleDateString()}`
          : ""}
      </p>
      <p class="hero-actions">
        {due > 0 ? (
          <a class="btn btn-lg" href="#/review">
            Review {due} due question{due === 1 ? "" : "s"}
          </a>
        ) : pendingExam ? (
          <a class="btn btn-lg" href={examHref(pendingExam.id)}>
            Take the {pendingExam.title.split(":")[0]} exam
          </a>
        ) : continueLesson ? (
          <a class="btn btn-lg" href={lessonHref(continueLesson.id)}>
            Continue: {continueLesson.title}
          </a>
        ) : (
          <a class="btn btn-lg" href={quizHref(curriculum.modules[0]!.lessons[0]!.id)}>
            Everything passed. Requiz yourself
          </a>
        )}
        <a class="hero-secondary" href="#/dashboard">
          Full progress →
        </a>
      </p>
    </section>
  );
}

/* Flat-color PCB trace behind the hero — the decorative element. Solid
   strokes only: gradients band on LCD panels (learned the hard way). The
   dash slowly draws and retreats; reduced-motion freezes it. */
function TraceDecor() {
  return (
    <svg
      class="hero-trace"
      viewBox="0 0 480 120"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMaxYMid meet"
    >
      <path class="hero-trace-path" d="M0 90 H150 L190 50 H300 L340 90 H440" />
      <circle cx="446" cy="90" r="5" class="hero-trace-via" />
      <circle cx="300" cy="50" r="4" class="hero-trace-via" />
    </svg>
  );
}

/* First-run rail: teach the loop in the app's own visual language. */
function HowItWorks() {
  return (
    <section>
      <h3 class="dash-section">How it works</h3>
      <ul class="loop-steps">
        <li>
          <span class="via" />
          Read a lesson. Every claim carries its sources.
        </li>
        <li>
          <span class="via ringed" />
          Take its quiz. Every answer is saved on this device, instantly.
        </li>
        <li>
          <span class="via filled" />
          Missed questions come back tomorrow; known ones wait longer. The streak and
          mastery numbers up top do the honest bookkeeping.
        </li>
      </ul>
    </section>
  );
}
