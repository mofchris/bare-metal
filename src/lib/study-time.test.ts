import { describe, expect, it } from "vitest";
import {
  DAILY_GOAL_SECONDS,
  dayCounted,
  secondsByDay,
  studyStreak,
  studyTimeId,
  type StudyTimeRecord,
} from "./study-time";

const rec = (day: string, seconds: number, installId = "dev-a"): StudyTimeRecord => ({
  id: studyTimeId(day, installId),
  day,
  installId,
  seconds,
});

const noonLocal = (isoDay: string) => new Date(`${isoDay}T12:00:00`);

describe("secondsByDay", () => {
  it("sums the same day across devices", () => {
    const map = secondsByDay([
      rec("2026-07-19", 1000, "laptop"),
      rec("2026-07-19", 900, "phone"),
      rec("2026-07-18", 500),
    ]);
    expect(map.get("2026-07-19")).toBe(1900);
    expect(map.get("2026-07-18")).toBe(500);
  });
});

describe("dayCounted — the 30-minute rule", () => {
  it("requires the daily goal when time was tracked", () => {
    const seconds = new Map([
      ["2026-07-19", DAILY_GOAL_SECONDS],
      ["2026-07-18", DAILY_GOAL_SECONDS - 1],
    ]);
    expect(dayCounted("2026-07-19", seconds, new Set())).toBe(true);
    expect(dayCounted("2026-07-18", seconds, new Set())).toBe(false);
  });

  it("grandfathers pre-tracking days: attempts count only when NO time row exists", () => {
    const attemptDays = new Set(["2026-07-01", "2026-07-18"]);
    const seconds = new Map([["2026-07-18", 120]]); // tracked but short
    expect(dayCounted("2026-07-01", seconds, attemptDays)).toBe(true); // legacy day
    expect(dayCounted("2026-07-18", seconds, attemptDays)).toBe(false); // tracked short day
  });
});

describe("studyStreak", () => {
  it("counts consecutive goal-met days and reports today's seconds", () => {
    const records = [
      rec("2026-07-17", DAILY_GOAL_SECONDS),
      rec("2026-07-18", DAILY_GOAL_SECONDS + 300),
      rec("2026-07-19", 600),
    ];
    const streak = studyStreak(records, new Set(), noonLocal("2026-07-19"));
    expect(streak.current).toBe(2); // today short but doesn't break it yet
    expect(streak.todaySeconds).toBe(600);
  });

  it("extends the streak through today once today meets the goal", () => {
    const records = [
      rec("2026-07-18", DAILY_GOAL_SECONDS),
      rec("2026-07-19", DAILY_GOAL_SECONDS),
    ];
    expect(studyStreak(records, new Set(), noonLocal("2026-07-19")).current).toBe(2);
  });

  it("breaks across a missed day and bridges legacy attempt-only days", () => {
    const records = [rec("2026-07-19", DAILY_GOAL_SECONDS)];
    const attemptDays = new Set(["2026-07-18"]); // pre-tracking day
    expect(studyStreak(records, attemptDays, noonLocal("2026-07-19")).current).toBe(2);
    expect(studyStreak(records, new Set(), noonLocal("2026-07-19")).current).toBe(1);
  });
});
