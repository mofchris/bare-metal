// Question selection: decides WHICH questions a quiz run serves, so retaking a
// quiz rotates through the bank instead of replaying the same list in the same
// order (D-030 — Christopher hit this retrying a quiz he had failed).
//
// Depends on: curriculum.ts (types) and progress-store.ts for the AttemptRecord
// type only — `import type`, so this module carries no runtime dependency on
// IndexedDB and stays testable as a pure function.
// Depended on by: checkpoints.ts, app.tsx, components/quiz.tsx.
//
// WHY ROTATION RATHER THAN RANDOMNESS. Shuffling cannot promise "you won't see
// that question again for N takes": draw 5 from a bank of 30 at random and the
// same question can reappear on the very next take, because independent draws
// collide. Serving the least recently seen questions first can promise it. Each
// take pushes what it served to the back of the queue, so a pool of P questions
// answering N per quiz yields floor(P / N) clean takes before anything comes
// round again — a property tests can actually assert. Randomness survives only
// where it does no harm: breaking ties between equally stale questions, and
// varying the order the chosen questions are presented in, so he isn't
// memorising "the answer to number three".
//
// WHY NO NEW STORAGE. `attempts` is append-only ground truth already carrying a
// questionId, a correctness flag and an ISO timestamp for every answer ever
// graded, so "has he seen this, when, and did he get it right" is DERIVED, the
// same discipline srsState follows (see progress-store.ts). No new object
// store, no schema version bump, and therefore none of the blocked-upgrade risk
// that produced the 2026-07-19 hotfix.

import type { Module, Question } from "./curriculum";
import type { AttemptRecord } from "./progress-store";

/** What the attempt history says about one question. */
export interface QuestionHistory {
  /** Epoch ms of the most recent answer. */
  lastSeenAt: number;
  /** Whether that most recent answer was correct. */
  lastAnswerCorrect: boolean;
  /** How many times it has been answered, ever. */
  timesSeen: number;
}

/**
 * Fold the append-only attempt log into a per-question summary.
 * Attempts may arrive in any order (sync merges history from other devices),
 * so "most recent" is decided by timestamp rather than by position.
 */
export function summariseHistory(
  attempts: readonly AttemptRecord[],
): Map<string, QuestionHistory> {
  const summary = new Map<string, QuestionHistory>();
  for (const attempt of attempts) {
    const at = Date.parse(attempt.at);
    // A malformed timestamp would sort as NaN and poison the ordering, so the
    // record is skipped loudly rather than silently corrupting the rotation.
    if (Number.isNaN(at)) {
      console.error(
        `Metal: attempt for ${attempt.questionId} has an unparseable ` +
          `timestamp "${attempt.at}" and was ignored for question selection.`,
      );
      continue;
    }
    const existing = summary.get(attempt.questionId);
    if (existing === undefined) {
      summary.set(attempt.questionId, {
        lastSeenAt: at,
        lastAnswerCorrect: attempt.correct,
        timesSeen: 1,
      });
      continue;
    }
    existing.timesSeen += 1;
    if (at >= existing.lastSeenAt) {
      existing.lastSeenAt = at;
      existing.lastAnswerCorrect = attempt.correct;
    }
  }
  return summary;
}

/**
 * Priority band, lowest served first. The bands encode Christopher's own
 * framing of the problem: a retry he asked to feel fresh should reach for
 * questions he has not met before, and the ones he just got wrong belong in the
 * spaced-review deck (srs.ts), which exists precisely to bring them back on a
 * schedule — not stuffed straight back into the retake he complained about.
 * They still outrank questions he answered correctly, because once the bank is
 * exhausted, re-meeting a specific misunderstanding is the repeat worth having.
 */
const BAND_NEVER_SEEN = 0;
const BAND_SEEN_AND_WRONG = 1;
const BAND_SEEN_AND_RIGHT = 2;

function bandFor(history: QuestionHistory | undefined): number {
  if (history === undefined) return BAND_NEVER_SEEN;
  return history.lastAnswerCorrect ? BAND_SEEN_AND_RIGHT : BAND_SEEN_AND_WRONG;
}

/**
 * Choose `count` questions from `pool`, worst-served first.
 *
 * Ordering: never-seen, then seen-and-wrong, then seen-and-right; within a band,
 * least recently seen first; ties broken randomly. The returned list is then
 * shuffled, so the order questions appear in a quiz is not the order they were
 * chosen in.
 *
 * A pool smaller than `count` returns the whole pool (shuffled) rather than
 * padding or throwing — a lesson with five questions and a five-question quiz
 * is the situation this engine cannot fix, and it is the template expansion in
 * the content compiler that fixes it by growing the pool.
 */
export function selectQuestions(
  pool: readonly Question[],
  history: ReadonlyMap<string, QuestionHistory>,
  count: number,
  rng: () => number = Math.random,
): Question[] {
  const ranked = pool.map((question) => {
    const seen = history.get(question.id);
    return {
      question,
      band: bandFor(seen),
      lastSeenAt: seen?.lastSeenAt ?? 0,
      tieBreak: rng(),
    };
  });

  ranked.sort(
    (a, b) => a.band - b.band || a.lastSeenAt - b.lastSeenAt || a.tieBreak - b.tieBreak,
  );

  return shuffle(
    ranked.slice(0, Math.max(0, count)).map((r) => r.question),
    rng,
  );
}

/**
 * How many times a quiz of `quizSize` can be taken from a bank of `poolSize`
 * before a question necessarily repeats. Exported because it is the number
 * Christopher actually asked about, and it keeps the promise honest in the UI
 * and in tests instead of leaving it as a claim in a commit message.
 */
export function cleanTakes(poolSize: number, quizSize: number): number {
  if (quizSize <= 0) return 0;
  return Math.floor(poolSize / quizSize);
}

/**
 * How many questions a lesson quiz asks. Fixed rather than "however many the
 * lesson has", because templates make bank size vary wildly — m1/02 now holds
 * 30 questions, and serving all of them would turn a five-minute quiz into a
 * thirty-question slog. Five keeps the quiz the length it has always been and
 * lets the surplus become rotation instead of length.
 */
export const LESSON_QUIZ_SIZE = 5;

/**
 * How many questions a module exam asks. Modules held 15–27 questions before
 * templates and exams simply served all of them; m1 alone now holds 73, so a
 * fixed size is required. Twenty sits inside the old range, so the exam feels
 * the same as the ones already sat.
 */
export const EXAM_SIZE = 20;

/** The questions a lesson quiz should serve this time round. */
export function lessonQuizQuestions(
  module: Module,
  lessonId: string,
  history: ReadonlyMap<string, QuestionHistory>,
  count = LESSON_QUIZ_SIZE,
  rng: () => number = Math.random,
): Question[] {
  const pool = module.questions.filter((q) => q.lesson === lessonId);
  return selectQuestions(pool, history, count, rng);
}

/**
 * The questions a module exam should serve this time round: spread across the
 * module's lessons rather than drawn from the module as one bag, so an exam
 * cannot happen to ask five questions about one lesson and none about another.
 * A lesson with a thin bank contributes what it has and the shortfall is made
 * up from whatever is left, so the exam is always `count` long if the module
 * can fill it.
 */
export function examQuestions(
  module: Module,
  history: ReadonlyMap<string, QuestionHistory>,
  count = EXAM_SIZE,
  rng: () => number = Math.random,
): Question[] {
  const lessonIds = module.lessons.map((lesson) => lesson.id);
  if (lessonIds.length === 0)
    return selectQuestions(module.questions, history, count, rng);

  const base = Math.floor(count / lessonIds.length);
  const remainder = count % lessonIds.length;
  const chosen: Question[] = [];
  lessonIds.forEach((lessonId, i) => {
    const quota = base + (i < remainder ? 1 : 0);
    chosen.push(...lessonQuizQuestions(module, lessonId, history, quota, rng));
  });

  // Lessons with thin banks leave the exam short; top up from everything not
  // already picked, still worst-served first.
  if (chosen.length < count) {
    const taken = new Set(chosen.map((q) => q.id));
    const rest = module.questions.filter((q) => !taken.has(q.id));
    chosen.push(...selectQuestions(rest, history, count - chosen.length, rng));
  }
  return shuffle(chosen, rng);
}

/** Fisher–Yates over a copy, using the injected rng. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
