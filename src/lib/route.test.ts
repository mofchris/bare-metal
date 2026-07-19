import { describe, expect, it } from "vitest";
import { lessonHref, parseRoute, quizHref } from "./route";

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

  it("parses the review, dashboard, and backup routes", () => {
    expect(parseRoute("#/review")).toEqual({ screen: "review" });
    expect(parseRoute("#/dashboard")).toEqual({ screen: "dashboard" });
    expect(parseRoute("#/backup")).toEqual({ screen: "backup" });
  });

  it("parses exam routes", () => {
    expect(parseRoute("#/exam/m1-hardware-foundations")).toEqual({
      screen: "exam",
      moduleId: "m1-hardware-foundations",
    });
    expect(parseRoute("#/exam/")).toEqual({ screen: "home" });
  });

  it("parses quiz routes and treats a bare quiz prefix as home", () => {
    expect(parseRoute(quizHref("m1/01-memory-hierarchy"))).toEqual({
      screen: "quiz",
      lessonId: "m1/01-memory-hierarchy",
    });
    expect(parseRoute("#/quiz/")).toEqual({ screen: "home" });
  });
});
