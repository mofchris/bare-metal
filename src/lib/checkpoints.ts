// Checkpoint quizzes: after every two modules, a short mixed quiz drawn from
// those two modules' question banks. OPTIONAL and UNGATED by design — taking
// one records attempts and feeds the spaced-review schedule (like any quiz),
// but it sets no lesson or exam status and is never a prerequisite for
// anything. Pairs are derived from curriculum order, so they extend
// automatically as modules are authored.
//
// Depends on: curriculum.ts (types). Depended on by: route.ts, app.tsx, home.tsx.

import type { Module, Question } from "./curriculum";

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

/**
 * A balanced, shuffled sample across the two modules — as even a split as the
 * banks allow, up to `count` total. If one module has fewer questions, the
 * other makes up the difference. Questions alternate between the two rather
 * than clumping. `rng` is injected so tests are deterministic; the app passes
 * Math.random so each attempt gets a fresh mix.
 */
export function checkpointQuestions(
  checkpoint: Checkpoint,
  count = CHECKPOINT_SIZE,
  rng: () => number = Math.random,
): Question[] {
  const a = shuffle(checkpoint.first.questions, rng);
  const b = shuffle(checkpoint.second.questions, rng);

  // Aim for half from each. When one bank is short, take more from the other,
  // but never more than a bank actually has.
  const half = Math.floor(count / 2);
  const fromA = Math.min(a.length, Math.max(half, count - b.length));
  const fromB = Math.min(b.length, count - fromA);

  return interleave(a.slice(0, fromA), b.slice(0, fromB));
}

/** Fisher–Yates over a copy, using the injected rng. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
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
