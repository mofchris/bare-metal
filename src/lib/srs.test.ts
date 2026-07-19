import { describe, expect, it } from "vitest";
import {
  dueQuestionIds,
  INITIAL_EASE,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  nextDueAt,
  updateSrs,
  type SrsState,
} from "./srs";

const t0 = new Date("2026-07-19T12:00:00.000Z");
const daysLater = (d: number) => new Date(t0.getTime() + d * 24 * 60 * 60 * 1000);

const replay = (answers: boolean[], id = "q"): SrsState => {
  let state: SrsState | null = null;
  answers.forEach((correct, i) => {
    state = updateSrs(state, id, correct, daysLater(i));
  });
  return state!;
};

describe("updateSrs scheduling", () => {
  it("walks the SM-2 ladder on consecutive correct answers: 1, 6, then ×ease", () => {
    expect(replay([true]).intervalDays).toBe(1);
    expect(replay([true, true]).intervalDays).toBe(6);
    // third success: 6 × 2.5 = 15
    expect(replay([true, true, true]).intervalDays).toBe(15);
    expect(replay([true, true, true]).dueAt).toBe(daysLater(2 + 15).toISOString());
  });

  it("resurfaces a missed question the next day and penalizes ease", () => {
    const state = replay([true, true, false]);
    expect(state.intervalDays).toBe(1);
    expect(state.reps).toBe(0);
    expect(state.lapses).toBe(1);
    expect(state.ease).toBeCloseTo(INITIAL_EASE - 0.2);
  });

  it("never drops ease below the floor, no matter how many lapses", () => {
    const state = replay([false, false, false, false, false, false, false, false]);
    expect(state.ease).toBe(MIN_EASE);
    expect(state.lapses).toBe(8);
  });

  it("caps intervals so nothing schedules past the horizon", () => {
    const state = replay([true, true, true, true, true, true, true]);
    expect(state.intervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
    expect(state.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("restarts the ladder after a lapse instead of resuming long intervals", () => {
    const state = replay([true, true, true, false, true]);
    expect(state.intervalDays).toBe(1); // first success after relearning
  });
});

describe("due selection", () => {
  const s = (id: string, dueInDays: number): SrsState => ({
    questionId: id,
    dueAt: daysLater(dueInDays).toISOString(),
    intervalDays: 1,
    ease: INITIAL_EASE,
    reps: 1,
    lapses: 0,
    lastReviewedAt: t0.toISOString(),
  });

  it("returns due questions most-overdue first and excludes future ones", () => {
    const states = [s("fresh", 5), s("overdue-long", -3), s("overdue-recent", -1)];
    expect(dueQuestionIds(states, t0)).toEqual(["overdue-long", "overdue-recent"]);
  });

  it("reports the earliest upcoming due date, or null when nothing is scheduled", () => {
    expect(nextDueAt([s("a", 5), s("b", 2)], t0)).toBe(daysLater(2).toISOString());
    expect(nextDueAt([s("a", -1)], t0)).toBeNull();
  });
});
