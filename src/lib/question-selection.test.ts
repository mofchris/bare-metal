import { describe, expect, it, vi } from "vitest";
import {
  cleanTakes,
  selectQuestions,
  summariseHistory,
  type QuestionHistory,
} from "./question-selection";
import type { Question } from "./curriculum";
import type { AttemptRecord } from "./progress-store";

/** `n` throwaway questions, ids q-0 … q-(n-1). */
function pool(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q-${i}`,
    lesson: "m1/01",
    type: "mcq",
    prompt: `q${i}`,
    options: ["a", "b"],
    answer: 0,
    explanation: "because",
    tags: [],
  })) as Question[];
}

function attempt(questionId: string, at: string, correct: boolean): AttemptRecord {
  return { questionId, at, correct, givenAnswer: "a", sessionId: "s1" };
}

/** Deterministic rng cycling through fixed values, for reproducible shuffles. */
function seededRng(seed = 1): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

/** Answer every question in `served` correctly, one second apart, from `start`. */
function answered(served: Question[], start: number): AttemptRecord[] {
  return served.map((q, i) =>
    attempt(q.id, new Date(start + i * 1000).toISOString(), true),
  );
}

describe("summariseHistory", () => {
  it("counts every answer but keeps only the most recent verdict", () => {
    const history = summariseHistory([
      attempt("q-0", "2026-07-01T10:00:00.000Z", false),
      attempt("q-0", "2026-07-02T10:00:00.000Z", true),
    ]);
    expect(history.get("q-0")).toEqual<QuestionHistory>({
      lastSeenAt: Date.parse("2026-07-02T10:00:00.000Z"),
      lastAnswerCorrect: true,
      timesSeen: 2,
    });
  });

  it("decides the most recent answer by timestamp, not arrival order", () => {
    // Sync merges history from another device, so attempts arrive unordered.
    const history = summariseHistory([
      attempt("q-0", "2026-07-02T10:00:00.000Z", true),
      attempt("q-0", "2026-07-01T10:00:00.000Z", false),
    ]);
    expect(history.get("q-0")?.lastAnswerCorrect).toBe(true);
  });

  it("ignores an attempt with an unparseable timestamp and says so loudly", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const history = summariseHistory([attempt("q-0", "not a date", true)]);
    expect(history.has("q-0")).toBe(false);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe("selectQuestions", () => {
  it("serves questions never seen before ahead of anything already answered", () => {
    const questions = pool(4);
    const history = summariseHistory([
      attempt("q-0", "2026-07-01T10:00:00.000Z", true),
      attempt("q-1", "2026-07-01T10:00:00.000Z", false),
    ]);
    const served = selectQuestions(questions, history, 2, seededRng());
    expect(served.map((q) => q.id).sort()).toEqual(["q-2", "q-3"]);
  });

  it("prefers a question answered wrongly over one answered correctly at the same time", () => {
    const questions = pool(2);
    const sameMoment = "2026-07-01T10:00:00.000Z";
    const history = summariseHistory([
      attempt("q-0", sameMoment, true),
      attempt("q-1", sameMoment, false),
    ]);
    const served = selectQuestions(questions, history, 1, seededRng());
    expect(served.map((q) => q.id)).toEqual(["q-1"]);
  });

  it("serves the least recently seen first once everything has been answered", () => {
    const questions = pool(3);
    const history = summariseHistory([
      attempt("q-0", "2026-07-03T10:00:00.000Z", true),
      attempt("q-1", "2026-07-01T10:00:00.000Z", true),
      attempt("q-2", "2026-07-02T10:00:00.000Z", true),
    ]);
    const served = selectQuestions(questions, history, 2, seededRng());
    expect(served.map((q) => q.id).sort()).toEqual(["q-1", "q-2"]);
  });

  it("rotates a 30-question bank through 6 five-question takes with no repeat", () => {
    // The promise made to Christopher in D-030, asserted rather than claimed.
    const questions = pool(30);
    const attempts: AttemptRecord[] = [];
    const seenIds = new Set<string>();
    let clock = Date.parse("2026-07-01T10:00:00.000Z");

    for (let take = 0; take < 6; take++) {
      const served = selectQuestions(
        questions,
        summariseHistory(attempts),
        5,
        seededRng(take + 1),
      );
      expect(served).toHaveLength(5);
      for (const question of served) {
        expect(seenIds.has(question.id)).toBe(false);
        seenIds.add(question.id);
      }
      attempts.push(...answered(served, clock));
      clock += 60 * 60 * 1000; // an hour between takes
    }
    expect(seenIds.size).toBe(30);
  });

  it("returns the whole pool when the quiz is as large as the bank", () => {
    // The case the engine cannot fix — a 5-question lesson with a 5-question
    // quiz. Growing the bank is the fix; this just must not crash or pad.
    const questions = pool(5);
    const served = selectQuestions(questions, new Map(), 5, seededRng());
    expect(served.map((q) => q.id).sort()).toEqual(["q-0", "q-1", "q-2", "q-3", "q-4"]);
  });

  it("varies presentation order between takes of the same questions", () => {
    const questions = pool(5);
    const first = selectQuestions(questions, new Map(), 5, seededRng(1));
    const second = selectQuestions(questions, new Map(), 5, seededRng(9));
    expect(first.map((q) => q.id)).not.toEqual(second.map((q) => q.id));
  });

  it("asks for nothing without throwing when the pool is empty", () => {
    expect(selectQuestions([], new Map(), 5, seededRng())).toEqual([]);
  });
});

describe("cleanTakes", () => {
  it("reports how many takes a bank survives before a question must repeat", () => {
    expect(cleanTakes(30, 5)).toBe(6);
    expect(cleanTakes(217, 12)).toBe(18);
    expect(cleanTakes(5, 5)).toBe(1);
  });

  it("reports zero rather than dividing by zero for an empty quiz", () => {
    expect(cleanTakes(30, 0)).toBe(0);
  });
});
