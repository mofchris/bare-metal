import { describe, expect, it } from "vitest";
import {
  dailyReviewPool,
  dailyReviewQuestions,
  DAILY_REVIEW_SIZE,
  isDailyReviewDue,
} from "./daily-review";
import type { Curriculum, Question } from "./curriculum";
import type { LessonProgressRecord } from "./progress-store";

function curriculumWith(lessonCounts: Record<string, number>): Curriculum {
  const questions: Question[] = [];
  for (const [lessonId, n] of Object.entries(lessonCounts)) {
    for (let i = 0; i < n; i++) {
      questions.push({
        id: `${lessonId}/q-${i}`,
        lesson: lessonId,
        type: "mcq",
        prompt: "p",
        options: ["a", "b"],
        answer: 0,
        explanation: "because",
        tags: [],
      } as Question);
    }
  }
  return {
    contentVersion: "test",
    modules: [
      {
        id: "m-test",
        title: "Test",
        prereqs: [],
        lessons: Object.keys(lessonCounts).map((id) => ({ id }) as never),
        questions,
      },
    ],
  } as unknown as Curriculum;
}

function statuses(
  entries: Record<string, LessonProgressRecord["status"]>,
): Map<string, LessonProgressRecord> {
  return new Map(
    Object.entries(entries).map(([lessonId, status]) => [lessonId, { lessonId, status }]),
  );
}

function seededRng(seed = 1): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

describe("dailyReviewPool", () => {
  it("offers questions only from lessons already completed", () => {
    const curriculum = curriculumWith({ "l/01": 3, "l/02": 3, "l/03": 3 });
    const pool = dailyReviewPool(
      curriculum,
      statuses({ "l/01": "done", "l/02": "in-progress" }),
    );
    expect(pool.map((q) => q.lesson)).toEqual(["l/01", "l/01", "l/01"]);
  });

  it("is empty before any lesson is finished, so nothing is offered on day one", () => {
    const curriculum = curriculumWith({ "l/01": 3 });
    expect(dailyReviewPool(curriculum, statuses({}))).toEqual([]);
  });
});

describe("isDailyReviewDue", () => {
  it("offers the review on a day it has not yet been taken or dismissed", () => {
    expect(isDailyReviewDue("2026-07-26", undefined, undefined)).toBe(true);
    expect(isDailyReviewDue("2026-07-26", "2026-07-25", "2026-07-24")).toBe(true);
  });

  it("stops offering it once taken today", () => {
    expect(isDailyReviewDue("2026-07-26", "2026-07-26", undefined)).toBe(false);
  });

  it("stops offering it once dismissed today", () => {
    expect(isDailyReviewDue("2026-07-26", undefined, "2026-07-26")).toBe(false);
  });
});

describe("dailyReviewQuestions", () => {
  it("asks the standard number of questions when the pool is large enough", () => {
    const curriculum = curriculumWith({ "l/01": 30 });
    const pool = dailyReviewPool(curriculum, statuses({ "l/01": "done" }));
    expect(dailyReviewQuestions(pool, new Map(), undefined, seededRng())).toHaveLength(
      DAILY_REVIEW_SIZE,
    );
  });

  it("asks only what exists when the pool is smaller than a full review", () => {
    const curriculum = curriculumWith({ "l/01": 4 });
    const pool = dailyReviewPool(curriculum, statuses({ "l/01": "done" }));
    expect(dailyReviewQuestions(pool, new Map(), undefined, seededRng())).toHaveLength(4);
  });
});
