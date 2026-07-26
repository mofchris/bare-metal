import { describe, expect, it, vi } from "vitest";
import {
  cleanTakes,
  EXAM_SIZE,
  examQuestions,
  LESSON_QUIZ_SIZE,
  lessonQuizQuestions,
  selectQuestions,
  summariseHistory,
  type QuestionHistory,
} from "./question-selection";
import type { Module, Question } from "./curriculum";
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

/** A module whose lessons hold the given question counts. */
function moduleWith(counts: Record<string, number>): Module {
  const questions: Question[] = [];
  for (const [lessonId, n] of Object.entries(counts)) {
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
    id: "m-test",
    title: "Test module",
    prereqs: [],
    lessons: Object.keys(counts).map((id) => ({ id }) as never),
    questions,
  } as unknown as Module;
}

describe("lessonQuizQuestions", () => {
  it("asks the fixed quiz size even when the lesson bank is much larger", () => {
    // m1/02 really does hold 30 questions now; the quiz must stay five long.
    const module = moduleWith({ "l/01": 30 });
    const served = lessonQuizQuestions(module, "l/01", new Map(), undefined, seededRng());
    expect(served).toHaveLength(LESSON_QUIZ_SIZE);
  });

  it("draws only from the lesson asked for", () => {
    const module = moduleWith({ "l/01": 10, "l/02": 10 });
    const served = lessonQuizQuestions(module, "l/02", new Map(), undefined, seededRng());
    expect(served.every((q) => q.lesson === "l/02")).toBe(true);
  });

  it("serves a whole thin bank rather than padding it", () => {
    const module = moduleWith({ "l/01": 3 });
    const served = lessonQuizQuestions(module, "l/01", new Map(), undefined, seededRng());
    expect(served).toHaveLength(3);
  });

  it("gives six clean retakes from a thirty-question lesson", () => {
    const module = moduleWith({ "l/01": 30 });
    const attempts: AttemptRecord[] = [];
    const seen = new Set<string>();
    let clock = Date.parse("2026-07-01T10:00:00.000Z");
    for (let take = 0; take < 6; take++) {
      const served = lessonQuizQuestions(
        module,
        "l/01",
        summariseHistory(attempts),
        undefined,
        seededRng(take + 1),
      );
      for (const q of served) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
      attempts.push(...answered(served, clock));
      clock += 3_600_000;
    }
    expect(seen.size).toBe(30);
  });
});

describe("examQuestions", () => {
  it("spreads the exam across every lesson instead of over-sampling one", () => {
    const module = moduleWith({ "l/01": 30, "l/02": 10, "l/03": 10, "l/04": 10 });
    const served = examQuestions(module, new Map(), EXAM_SIZE, seededRng());
    expect(served).toHaveLength(EXAM_SIZE);
    for (const lessonId of ["l/01", "l/02", "l/03", "l/04"]) {
      expect(served.filter((q) => q.lesson === lessonId).length).toBe(5);
    }
  });

  it("tops up from other lessons when one bank is too thin to fill its share", () => {
    const module = moduleWith({ "l/01": 30, "l/02": 1 });
    const served = examQuestions(module, new Map(), EXAM_SIZE, seededRng());
    expect(served).toHaveLength(EXAM_SIZE);
    expect(served.filter((q) => q.lesson === "l/02")).toHaveLength(1);
  });

  it("never repeats a question inside one exam", () => {
    const module = moduleWith({ "l/01": 30, "l/02": 1 });
    const served = examQuestions(module, new Map(), EXAM_SIZE, seededRng());
    expect(new Set(served.map((q) => q.id)).size).toBe(served.length);
  });

  it("returns only what exists when the module cannot fill the exam", () => {
    const module = moduleWith({ "l/01": 4, "l/02": 3 });
    const served = examQuestions(module, new Map(), EXAM_SIZE, seededRng());
    expect(served).toHaveLength(7);
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
