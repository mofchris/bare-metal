// Checkpoint quizzes: after every two modules, a short mixed quiz drawn from
// those two modules' question banks. OPTIONAL and UNGATED by design — taking
// one records attempts and feeds the spaced-review schedule (like any quiz),
// but it sets no lesson or exam status and is never a prerequisite for
// anything. Pairs are derived from curriculum order, so they extend
// automatically as modules are authored.
//
// Depends on: curriculum.ts (types), question-selection.ts (which questions a
// given run serves). Depended on by: route.ts, app.tsx, home.tsx.

import type { Module, Question } from "./curriculum";
import { selectQuestions, type QuestionHistory } from "./question-selection";

export interface Checkpoint {
  /** Stable id — the first module's id, which uniquely names the pair. */
  id: string;
  first: Module;
  second: Module;
  /** 1-based position, for display ("Checkpoint 2"). */
  number: number;
}

/** Default number of questions a checkpoint quiz draws. */
export const CHECKPOINT_SIZE = 12;

/**
 * Consecutive modules paired: (1,2), (3,4), and so on. A trailing odd module
 * has no checkpoint until its partner is authored. Order follows the order the
 * modules are given, which is curriculum order.
 */
export function checkpointPairs(modules: readonly Module[]): Checkpoint[] {
  const pairs: Checkpoint[] = [];
  for (let i = 0; i + 1 < modules.length; i += 2) {
    pairs.push({
      id: modules[i]!.id,
      first: modules[i]!,
      second: modules[i + 1]!,
      number: i / 2 + 1,
    });
  }
  return pairs;
}

/** The checkpoint whose first module has this id, or null if none. */
export function checkpointById(
  modules: readonly Module[],
  firstModuleId: string,
): Checkpoint | null {
  return checkpointPairs(modules).find((c) => c.id === firstModuleId) ?? null;
}

export interface CheckpointSampleOptions {
  /** How many questions to draw. Defaults to CHECKPOINT_SIZE. */
  count?: number;
  /**
   * Per-question attempt history, from summariseHistory(). Supplying it makes
   * the draw rotate through the banks instead of sampling blind (D-030);
   * omitting it degrades to "everything is unseen", which is the correct
   * behaviour on a fresh install and keeps this callable from tests that do
   * not care about rotation.
   */
  history?: ReadonlyMap<string, QuestionHistory>;
  /** Injected so tests are deterministic; the app passes Math.random. */
  rng?: () => number;
}

/**
 * A balanced sample across the two modules — as even a split as the banks
 * allow, up to `count` total. If one module has fewer questions, the other
 * makes up the difference. Questions alternate between the two rather than
 * clumping.
 *
 * Selection within each bank is delegated to question-selection.ts, so a
 * checkpoint retaken next week reaches for questions he has not answered
 * before rather than re-rolling the dice over the whole bank. With 217
 * questions in the curriculum and a 12-question checkpoint, that is 18 takes
 * before anything is forced to repeat (cleanTakes(217, 12)).
 */
export function checkpointQuestions(
  checkpoint: Checkpoint,
  options: CheckpointSampleOptions = {},
): Question[] {
  const {
    count = CHECKPOINT_SIZE,
    history = new Map<string, QuestionHistory>(),
    rng = Math.random,
  } = options;

  // Aim for half from each. When one bank is short, take more from the other,
  // but never more than a bank actually has.
  const half = Math.floor(count / 2);
  const firstBank = checkpoint.first.questions;
  const secondBank = checkpoint.second.questions;
  const fromA = Math.min(firstBank.length, Math.max(half, count - secondBank.length));
  const fromB = Math.min(secondBank.length, count - fromA);

  return interleave(
    selectQuestions(firstBank, history, fromA, rng),
    selectQuestions(secondBank, history, fromB, rng),
  );
}

/** a[0], b[0], a[1], b[1], … keeping any leftover tail of the longer list. */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
}
