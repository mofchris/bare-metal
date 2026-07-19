import { describe, expect, it } from "vitest";
import type { Curriculum } from "./curriculum";
import { findLesson, questionCountFor } from "./lookup";

const lesson = (id: string) => ({
  id,
  title: id,
  objectives: ["o"],
  sources: ["s"],
  html: "<p>x</p>",
});

const curriculum: Curriculum = {
  contentVersion: "test",
  modules: [
    {
      id: "m1",
      title: "M1",
      prereqs: [],
      lessons: [lesson("m1/01"), lesson("m1/02")],
      questions: [
        {
          id: "q1",
          lesson: "m1/01",
          type: "short",
          prompt: "p",
          accept: ["a"],
          explanation: "e",
          tags: [],
        },
      ],
    },
  ],
};

describe("findLesson", () => {
  it("returns the lesson, its module, and the next lesson in module order", () => {
    const found = findLesson(curriculum, "m1/01");
    expect(found?.module.id).toBe("m1");
    expect(found?.lesson.id).toBe("m1/01");
    expect(found?.next?.id).toBe("m1/02");
  });

  it("returns null next for the last lesson, and null for unknown ids", () => {
    expect(findLesson(curriculum, "m1/02")?.next).toBeNull();
    expect(findLesson(curriculum, "nope")).toBeNull();
  });
});

describe("questionCountFor", () => {
  it("counts only questions attached to the given lesson", () => {
    expect(questionCountFor(curriculum.modules[0]!, "m1/01")).toBe(1);
    expect(questionCountFor(curriculum.modules[0]!, "m1/02")).toBe(0);
  });
});
