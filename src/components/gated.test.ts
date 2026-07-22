// Regression tests for the D-023 gating bypass Christopher found: the route
// guard kept its verdict across lesson→lesson navigation, so a lesson could be
// opened from the previous lesson's footer without ever taking the quiz.

import { describe, expect, it } from "vitest";
import { stateFor, type Verdict } from "./gated";

const openOnLessonOne: Verdict = {
  key: "lesson:m1/01-memory-hierarchy",
  state: { status: "open" },
};

describe("gate verdicts are scoped to one screen", () => {
  it("does not let a verdict from the previous lesson open the next one", () => {
    // The exact bypass: verdict says open, but it was decided about L01.
    const state = stateFor(openOnLessonOne, "lesson:m1/02-cpu-architecture");
    expect(state.status).toBe("checking");
    expect(state.status).not.toBe("open");
  });

  it("uses the verdict for the screen it was actually computed for", () => {
    expect(stateFor(openOnLessonOne, "lesson:m1/01-memory-hierarchy").status).toBe(
      "open",
    );
  });

  it("treats a lesson and its quiz as different screens", () => {
    expect(stateFor(openOnLessonOne, "quiz:m1/01-memory-hierarchy").status).toBe(
      "checking",
    );
  });

  it("withholds judgement before any check has run", () => {
    expect(stateFor(null, "lesson:m1/01-memory-hierarchy").status).toBe("checking");
  });

  it("keeps a locked verdict locked, with its reason intact", () => {
    const locked: Verdict = {
      key: "exam:m2-measurement",
      state: { status: "locked", reason: "Pass every lesson first." },
    };
    const state = stateFor(locked, "exam:m2-measurement");
    expect(state).toEqual({ status: "locked", reason: "Pass every lesson first." });
  });
});
