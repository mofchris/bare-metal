import { describe, expect, it } from "vitest";
import type { Curriculum } from "./curriculum";
import type { AttemptRecord } from "./progress-store";
import {
  localDateKey,
  masteryByLesson,
  runHistory,
  streakInfo,
  weakestLessons,
} from "./stats";

const q = (id: string, lesson: string) => ({
  id,
  lesson,
  type: "short" as const,
  prompt: "p",
  accept: ["a"],
  explanation: "e",
  tags: [],
});

const curriculum: Curriculum = {
  contentVersion: "test",
  modules: [
    {
      id: "m1",
      title: "M1",
      prereqs: [],
      lessons: [
        { id: "m1/l1", title: "L1", objectives: ["o"], sources: ["s"], html: "" },
        { id: "m1/l2", title: "L2", objectives: ["o"], sources: ["s"], html: "" },
      ],
      questions: [q("q1", "m1/l1"), q("q2", "m1/l1"), q("q3", "m1/l2")],
    },
  ],
};

const attempt = (
  questionId: string,
  at: string,
  correct: boolean,
  sessionId = "s1",
): AttemptRecord => ({ questionId, at, correct, givenAnswer: "x", sessionId });

describe("masteryByLesson", () => {
  it("counts a question as mastered only by its LATEST attempt", () => {
    const attempts = [
      attempt("q1", "2026-07-01T10:00:00Z", false),
      attempt("q1", "2026-07-02T10:00:00Z", true), // recovered → mastered
      attempt("q2", "2026-07-02T11:00:00Z", true),
      attempt("q2", "2026-07-03T10:00:00Z", false), // regressed → not mastered
    ];
    const [l1, l2] = masteryByLesson(curriculum, attempts);
    expect(l1).toMatchObject({
      mastered: 1,
      attempted: 2,
      totalQuestions: 2,
      masteryPct: 50,
    });
    expect(l2).toMatchObject({ attempted: 0, masteryPct: null });
  });
});

describe("weakestLessons", () => {
  it("ranks attempted lessons weakest-first and excludes untouched ones", () => {
    const attempts = [
      attempt("q1", "2026-07-01T10:00:00Z", true),
      attempt("q3", "2026-07-01T11:00:00Z", false),
    ];
    const weakest = weakestLessons(masteryByLesson(curriculum, attempts), 3);
    expect(weakest.map((w) => w.lessonId)).toEqual(["m1/l2", "m1/l1"]);
  });
});

describe("runHistory", () => {
  it("groups attempts into runs by sessionId, oldest first, capped to limit", () => {
    const attempts = [
      attempt("q1", "2026-07-02T10:00:00Z", true, "run-b"),
      attempt("q1", "2026-07-01T10:00:00Z", true, "run-a"),
      attempt("q2", "2026-07-01T10:01:00Z", false, "run-a"),
      attempt("q1", "2026-07-03T10:00:00Z", false, "run-c"),
    ];
    const runs = runHistory(attempts, 2);
    expect(runs.map((r) => r.sessionId)).toEqual(["run-b", "run-c"]);
    const all = runHistory(attempts, 10);
    expect(all[0]).toMatchObject({ sessionId: "run-a", correct: 1, total: 2 });
  });
});

describe("streakInfo", () => {
  const noonLocal = (isoDay: string) => new Date(`${isoDay}T12:00:00`);

  it("counts consecutive study days ending today", () => {
    const attempts = [
      attempt("q1", noonLocal("2026-07-17").toISOString(), true),
      attempt("q1", noonLocal("2026-07-18").toISOString(), true),
      attempt("q1", noonLocal("2026-07-19").toISOString(), true),
    ];
    expect(streakInfo(attempts, noonLocal("2026-07-19")).currentStreak).toBe(3);
  });

  it("doesn't break the streak just because today hasn't been studied yet", () => {
    const attempts = [
      attempt("q1", noonLocal("2026-07-17").toISOString(), true),
      attempt("q1", noonLocal("2026-07-18").toISOString(), true),
    ];
    expect(streakInfo(attempts, noonLocal("2026-07-19")).currentStreak).toBe(2);
  });

  it("resets across a missed day", () => {
    const attempts = [
      attempt("q1", noonLocal("2026-07-15").toISOString(), true),
      attempt("q1", noonLocal("2026-07-19").toISOString(), true),
    ];
    expect(streakInfo(attempts, noonLocal("2026-07-19")).currentStreak).toBe(1);
  });
});

describe("performance with large histories (Gate B requirement)", () => {
  it("derives all dashboard stats from 5000 attempts well under a frame budget", () => {
    const attempts: AttemptRecord[] = [];
    for (let i = 0; i < 5000; i++) {
      attempts.push(
        attempt(
          `q${(i % 3) + 1}`,
          new Date(Date.UTC(2026, 0, 1 + (i % 180), i % 24)).toISOString(),
          i % 3 !== 0,
          `session-${Math.floor(i / 10)}`,
        ),
      );
    }
    const start = performance.now();
    const mastery = masteryByLesson(curriculum, attempts);
    weakestLessons(mastery, 3);
    runHistory(attempts, 10);
    streakInfo(attempts, new Date());
    const elapsed = performance.now() - start;
    // Generous bound to stay CI-stable; typical is single-digit ms.
    expect(elapsed).toBeLessThan(200);
  });
});

describe("localDateKey", () => {
  it("uses the local wall clock, zero-padded", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
