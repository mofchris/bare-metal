import { describe, expect, it } from "vitest";
import { lessonHref, parseRoute } from "./route";

describe("parseRoute", () => {
  it("treats empty, root, and unknown hashes as home", () => {
    expect(parseRoute("")).toEqual({ screen: "home" });
    expect(parseRoute("#/")).toEqual({ screen: "home" });
    expect(parseRoute("#/nonsense")).toEqual({ screen: "home" });
    expect(parseRoute("#/lesson/")).toEqual({ screen: "home" });
  });

  it("extracts the full lesson id including its slashes", () => {
    expect(parseRoute("#/lesson/m1/01-memory-hierarchy")).toEqual({
      screen: "lesson",
      lessonId: "m1/01-memory-hierarchy",
    });
  });

  it("round-trips ids through lessonHref", () => {
    const id = "m1/01-memory-hierarchy";
    expect(parseRoute(lessonHref(id))).toEqual({ screen: "lesson", lessonId: id });
  });
});
