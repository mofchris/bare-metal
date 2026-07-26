import { describe, expect, it } from "vitest";
import {
  curriculumProgress,
  lessonProgressFraction,
  paceEstimate,
  type CurriculumProgress,
} from "./completion";
import type { Curriculum } from "./curriculum";
import type { LessonProgressRecord } from "./progress-store";
import type { StudyTimeRecord } from "./study-time";

function curriculumOf(lessonIds: string[]): Curriculum {
  return {
    contentVersion: "test",
    quotes: [],
    releaseNotes: [],
    modules: [
      {
        id: "m",
        title: "M",
        prereqs: [],
        questions: [],
        lessons: lessonIds.map((id) => ({ id })),
      },
    ],
  } as unknown as Curriculum;
}

const passed = (ids: string[]): Map<string, LessonProgressRecord> =>
  new Map(ids.map((id) => [id, { lessonId: id, status: "done", bestScorePct: 100 }]));

/** `days` of study, `minutes` each, ending the day before `2026-07-26`. */
function studyDays(days: string[], minutes: number): StudyTimeRecord[] {
  return days.map((day) => ({
    id: `${day}|dev`,
    day,
    installId: "dev",
    seconds: minutes * 60,
  }));
}

describe("curriculumProgress", () => {
  it("counts passed lessons against every lesson that exists", () => {
    const progress = curriculumProgress(
      curriculumOf(["a", "b", "c", "d"]),
      passed(["a", "b"]),
    );
    expect(progress).toEqual<CurriculumProgress>({ passed: 2, total: 4, pct: 50 });
  });

  it("reports zero rather than dividing by zero for an empty curriculum", () => {
    expect(curriculumProgress(curriculumOf([]), new Map()).pct).toBe(0);
  });
});

describe("paceEstimate", () => {
  const now = new Date(2026, 6, 26);

  it("projects a finish date from measured pace", () => {
    // 4 lessons of 10 done, 4 study days of 60 min = 240 min => 60 min/lesson.
    const progress = { passed: 4, total: 10, pct: 40 };
    const est = paceEstimate(
      progress,
      studyDays(["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"], 60),
      now,
    )!;
    expect(est.minutesPerLesson).toBe(60);
    expect(est.minutesPerActiveDay).toBe(60);
    // Studied all 4 elapsed days, so frequency is 1 and 6 lessons take 6 days.
    expect(est.studyFrequency).toBe(1);
    expect(est.daysRemaining).toBe(6);
    expect(est.finishDate.getDate()).toBe(1); // 26 July + 6 days
  });

  it("stretches the estimate when he studies only some days", () => {
    // Same work, but spread over 8 elapsed days with only 4 studied.
    const progress = { passed: 4, total: 10, pct: 40 };
    const est = paceEstimate(
      progress,
      studyDays(["2026-07-19", "2026-07-21", "2026-07-23", "2026-07-26"], 60),
      now,
    )!;
    expect(est.studyFrequency).toBeCloseTo(0.5, 1);
    // Half the days studied means roughly twice the calendar time.
    expect(est.daysRemaining).toBeGreaterThan(10);
  });

  it("says nothing until enough lessons are done to have a rate", () => {
    expect(
      paceEstimate({ passed: 1, total: 10, pct: 10 }, studyDays(["2026-07-23"], 60), now),
    ).toBeNull();
  });

  it("says nothing until he has studied on enough separate days", () => {
    expect(
      paceEstimate(
        { passed: 4, total: 10, pct: 40 },
        studyDays(["2026-07-25", "2026-07-26"], 60),
        now,
      ),
    ).toBeNull();
  });

  it("says nothing once the curriculum is finished", () => {
    expect(
      paceEstimate(
        { passed: 10, total: 10, pct: 100 },
        studyDays(["2026-07-23", "2026-07-24", "2026-07-25"], 60),
        now,
      ),
    ).toBeNull();
  });
});

describe("lessonProgressFraction", () => {
  it("shows a passed lesson as complete whatever the scroll position said", () => {
    expect(
      lessonProgressFraction({ lessonId: "a", status: "done", bestScorePct: 90 }, 0.2),
    ).toBe(1);
  });

  it("gives credit for reading before the quiz is passed", () => {
    expect(lessonProgressFraction(undefined, 0.5)).toBeCloseTo(0.4, 5);
  });

  it("never shows an unpassed lesson as finished, even when fully read", () => {
    // The quiz is the remaining fifth; 100% would be a lie.
    expect(lessonProgressFraction(undefined, 1)).toBeCloseTo(0.8, 5);
  });

  it("shows nothing for a lesson never opened", () => {
    expect(lessonProgressFraction(undefined, null)).toBe(0);
  });
});
