// Spaced-repetition engine: a binary-grade SM-2 variant (D-018).
// Depends on: nothing. Depended on by: progress-store.ts (persistence),
// components/review.tsx (due deck).
//
// Pure functions over plain data — every scheduling rule lives here and
// nowhere else, so the Gate B tests can feed fake histories and assert exact
// resurfacing dates.

export interface SrsState {
  questionId: string;
  /** ISO date the question becomes due for review. */
  dueAt: string;
  intervalDays: number;
  /** Growth factor for intervals; starts at 2.5, penalized on lapses. */
  ease: number;
  /** Successful reviews in a row (resets on a miss). */
  reps: number;
  /** Total misses ever — a "leech" signal for the dashboard. */
  lapses: number;
  lastReviewedAt: string;
}

export const INITIAL_EASE = 2.5;
// SM-2's floor: below ~1.3 intervals stop growing meaningfully and the card
// reviews forever. Same constant Anki uses.
export const MIN_EASE = 1.3;
export const EASE_PENALTY = 0.2;
// Cap so nothing schedules past ~3 months — the whole curriculum should stay
// in rotation before Fall 2027, and a 250-day interval is a goodbye, not a plan.
export const MAX_INTERVAL_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fold one graded answer into the schedule. `previous` is null for a first-ever attempt. */
export function updateSrs(
  previous: SrsState | null,
  questionId: string,
  correct: boolean,
  now: Date,
): SrsState {
  const prev = previous ?? {
    questionId,
    dueAt: now.toISOString(),
    intervalDays: 0,
    ease: INITIAL_EASE,
    reps: 0,
    lapses: 0,
    lastReviewedAt: now.toISOString(),
  };

  let intervalDays: number;
  let reps: number;
  let ease = prev.ease;
  let lapses = prev.lapses;

  if (correct) {
    reps = prev.reps + 1;
    // SM-2's opening ladder (1 day, 6 days), then multiplicative growth.
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(prev.intervalDays * ease);
    intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
  } else {
    reps = 0;
    lapses = prev.lapses + 1;
    ease = Math.max(MIN_EASE, ease - EASE_PENALTY);
    intervalDays = 1; // relearn tomorrow
  }

  return {
    questionId,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    intervalDays,
    ease,
    reps,
    lapses,
    lastReviewedAt: now.toISOString(),
  };
}

/** Question ids due at `now`, most overdue first. */
export function dueQuestionIds(states: SrsState[], now: Date): string[] {
  return states
    .filter((s) => new Date(s.dueAt).getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((s) => s.questionId);
}

/** Earliest upcoming due date strictly after `now`, or null if none scheduled. */
export function nextDueAt(states: SrsState[], now: Date): string | null {
  const upcoming = states
    .map((s) => s.dueAt)
    .filter((d) => new Date(d).getTime() > now.getTime())
    .sort();
  return upcoming[0] ?? null;
}
