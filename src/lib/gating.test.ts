import { describe, expect, it } from "vitest";
import type { Module } from "./curriculum";
import type { ExamResultRecord, LessonProgressRecord } from "./progress-store";
import {
  examUnlocked,
  lessonPassed,
  lessonUnlocked,
  moduleUnlocked,
  passedLessonCount,
} from "./gating";

const lesson = (id: string) => ({
  id,
  title: id,
  objectives: ["o"],
  sources: ["s"],
  html: "",
});

const mod = (id: string, lessonIds: string[], prereqs: string[] = []): Module => ({
  id,
  title: id,
  prereqs,
  lessons: lessonIds.map(lesson),
  questions: [],
});

const done = (pct?: number): LessonProgressRecord => ({
  lessonId: "x",
  status: "done",
  ...(pct !== undefined ? { bestScorePct: pct } : {}),
});

describe("lessonPassed", () => {
  it("requires done with at least 75%, and grandfathers score-less legacy records", () => {
    expect(lessonPassed(undefined)).toBe(false);
    expect(lessonPassed({ lessonId: "x", status: "in-progress" })).toBe(false);
    expect(lessonPassed(done(74))).toBe(false);
    expect(lessonPassed(done(75))).toBe(true);
    expect(lessonPassed(done())).toBe(true); // pre-gating record
  });
});

describe("lessonUnlocked", () => {
  const m = mod("m1", ["l1", "l2", "l3"]);

  it("opens the first lesson unconditionally and later ones on the previous pass", () => {
    const statuses = new Map([["l1", done(80)]]);
    expect(lessonUnlocked(m, "l1", new Map())).toBe(true);
    expect(lessonUnlocked(m, "l2", statuses)).toBe(true);
    expect(lessonUnlocked(m, "l3", statuses)).toBe(false); // l2 not passed
  });

  it("keeps a lesson locked when the previous score is below the mark", () => {
    expect(lessonUnlocked(m, "l2", new Map([["l1", done(60)]]))).toBe(false);
  });
});

describe("examUnlocked", () => {
  it("opens only when every lesson in the module is passed", () => {
    const m = mod("m1", ["l1", "l2"]);
    expect(examUnlocked(m, new Map([["l1", done(90)]]))).toBe(false);
    expect(
      examUnlocked(
        m,
        new Map([
          ["l1", done(90)],
          ["l2", done(75)],
        ]),
      ),
    ).toBe(true);
  });
});

describe("moduleUnlocked", () => {
  const passedExam: ExamResultRecord = {
    moduleId: "m1",
    bestScorePct: 80,
    passed: true,
    updatedAt: "2026-07-19T00:00:00.000Z",
  };

  it("opens prereq-free modules and gates the rest on prereq exams", () => {
    expect(moduleUnlocked(mod("m1", ["l"]), new Map())).toBe(true);
    const m2 = mod("m2", ["l"], ["m1"]);
    expect(moduleUnlocked(m2, new Map())).toBe(false);
    expect(moduleUnlocked(m2, new Map([["m1", passedExam]]))).toBe(true);
    expect(moduleUnlocked(m2, new Map([["m1", { ...passedExam, passed: false }]]))).toBe(
      false,
    );
  });
});

describe("passedLessonCount", () => {
  it("counts only passed lessons", () => {
    const m = mod("m1", ["l1", "l2", "l3"]);
    const statuses = new Map([
      ["l1", done(100)],
      ["l2", done(50)],
    ]);
    expect(passedLessonCount(m, statuses)).toBe(1);
  });

  it("keeps a lesson open once passed, even if a new lesson is inserted before it", () => {
    // The real regression: inserting m1/01b between 01 and 02 made 02's
    // predecessor a lesson he had never opened, so a lesson he had already
    // passed at 100% displayed as locked while the one after it stayed open.
    const withInsertion = mod("m", ["l/01", "l/01b", "l/02", "l/03"]);
    const statuses = new Map<string, LessonProgressRecord>([
      ["l/01", { lessonId: "l/01", status: "done", bestScorePct: 100 }],
      ["l/02", { lessonId: "l/02", status: "done", bestScorePct: 100 }],
    ]);
    expect(lessonUnlocked(withInsertion, "l/02", statuses)).toBe(true);
    // And the inserted lesson itself is open, because its predecessor passed.
    expect(lessonUnlocked(withInsertion, "l/01b", statuses)).toBe(true);
    // A lesson that is neither passed nor preceded by a pass stays locked.
    expect(lessonUnlocked(withInsertion, "l/03", statuses)).toBe(true);
  });
});
