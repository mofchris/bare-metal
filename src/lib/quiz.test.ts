import { describe, expect, it } from "vitest";
import type { McqQuestion, ShortQuestion } from "./curriculum";
import { gradeResponse } from "./quiz";

const mcq: McqQuestion = {
  id: "t/q-mcq",
  lesson: "t/l1",
  type: "mcq",
  prompt: "pick b",
  options: ["a", "b", "c"],
  answer: 1,
  explanation: "b is right",
  tags: [],
};

const short: ShortQuestion = {
  id: "t/q-short",
  lesson: "t/l1",
  type: "short",
  prompt: "say locality",
  accept: ["locality", "locality of reference"],
  explanation: "locality",
  tags: [],
};

describe("gradeResponse", () => {
  it("grades mcq by exact option index", () => {
    expect(gradeResponse(mcq, { type: "mcq", choice: 1 })).toBe(true);
    expect(gradeResponse(mcq, { type: "mcq", choice: 0 })).toBe(false);
  });

  it("grades short answers through the normalizing matcher", () => {
    expect(gradeResponse(short, { type: "short", text: "  Locality " })).toBe(true);
    expect(gradeResponse(short, { type: "short", text: "spatial" })).toBe(false);
  });

  it("throws on a response/question type mismatch instead of grading it wrong", () => {
    expect(() => gradeResponse(mcq, { type: "short", text: "b" })).toThrow(
      /mismatch|does not match/,
    );
  });
});
