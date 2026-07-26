// The daily review quiz (D-029): a short mixed quiz over material already
// completed, offered on the first open of each day and staying until it is
// either taken or dismissed.
//
// Depends on: curriculum.ts (types), question-selection.ts (which questions),
// progress-store.ts (LessonProgressRecord type only).
// Depended on by: app.tsx, components/home.tsx.
//
// WHY IT ONLY DRAWS FROM COMPLETED LESSONS. Christopher asked for questions
// "from units and modules you've already completed". That is also the only
// honest option: the app gates lessons behind their predecessor's quiz (D-023),
// so asking about a lesson he has not reached would test material the app has
// deliberately not shown him yet.
//
// WHY NO NEW STORAGE. "Taken today" and "dismissed today" are two strings, and
// the `meta` store already exists for exactly this kind of single value — so
// this feature needs no schema version bump and none of the blocked-upgrade
// risk that comes with one (see the 2026-07-19 hotfix).

import type { Curriculum, Question } from "./curriculum";
import type { LessonProgressRecord } from "./progress-store";
import { selectQuestions, type QuestionHistory } from "./question-selection";

/** Meta-store keys holding the local day each event last happened on. */
export const DAILY_REVIEW_TAKEN_KEY = "dailyReviewTakenDay";
export const DAILY_REVIEW_DISMISSED_KEY = "dailyReviewDismissedDay";

/**
 * How many questions the daily review asks. Ten is a few minutes rather than a
 * study session — the point is to keep old material warm without competing
 * with the day's actual lesson. With 263 questions in the curriculum it also
 * means many takes before anything repeats.
 */
export const DAILY_REVIEW_SIZE = 10;

/**
 * Every question attached to a lesson he has finished.
 * A lesson counts as finished when its progress record says "done", which is
 * what passing its quiz sets (D-023).
 */
export function dailyReviewPool(
  curriculum: Curriculum,
  statuses: ReadonlyMap<string, LessonProgressRecord>,
): Question[] {
  const completedLessons = new Set(
    [...statuses.values()].filter((r) => r.status === "done").map((r) => r.lessonId),
  );
  const pool: Question[] = [];
  for (const module of curriculum.modules) {
    for (const question of module.questions) {
      if (completedLessons.has(question.lesson)) pool.push(question);
    }
  }
  return pool;
}

/**
 * Should the review be offered today?
 *
 * It is offered once per local day and disappears for the rest of that day as
 * soon as it is taken or dismissed — Christopher's rule: it "should remain
 * there until the user either dismisses it or tries to complete it".
 */
export function isDailyReviewDue(
  today: string,
  takenDay: string | undefined,
  dismissedDay: string | undefined,
): boolean {
  return takenDay !== today && dismissedDay !== today;
}

/**
 * The questions to ask today, worst-served first so consecutive days do not
 * revisit the same ten. Returns fewer than `count` only when the pool is
 * smaller, and an empty list when no lesson has been completed yet — the
 * caller shows nothing rather than an empty quiz.
 */
export function dailyReviewQuestions(
  pool: readonly Question[],
  history: ReadonlyMap<string, QuestionHistory>,
  count = DAILY_REVIEW_SIZE,
  rng: () => number = Math.random,
): Question[] {
  return selectQuestions(pool, history, count, rng);
}
