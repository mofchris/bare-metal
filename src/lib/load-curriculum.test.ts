import { describe, expect, it } from "vitest";
import { validateCurriculumShape } from "./load-curriculum";

const plausible = {
  contentVersion: "abc123",
  modules: [{ id: "m1", title: "M1", prereqs: [], lessons: [], questions: [] }],
};

describe("validateCurriculumShape", () => {
  it("accepts a plausible compiled curriculum", () => {
    expect(validateCurriculumShape(plausible, "test")).toBe(plausible);
  });

  it("rejects non-objects, missing versions, and empty module lists with named source", () => {
    expect(() => validateCurriculumShape(null, "cur.json")).toThrow(/cur\.json/);
    expect(() => validateCurriculumShape({ modules: [] }, "x")).toThrow(/contentVersion/);
    expect(() =>
      validateCurriculumShape({ contentVersion: "a", modules: [] }, "x"),
    ).toThrow(/modules missing or empty/);
    expect(() =>
      validateCurriculumShape({ contentVersion: "a", modules: [{}] }, "x"),
    ).toThrow(/missing id or lessons/);
  });
});
