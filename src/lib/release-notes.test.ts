import { describe, expect, it } from "vitest";
import { noteToShow, versionToRecord } from "./release-notes";
import type { ReleaseNote } from "./curriculum";

const notes: ReleaseNote[] = [
  { version: "2026-07-26", headline: "Newest", changes: ["a"] },
  { version: "2026-07-20", headline: "Older", changes: ["b"] },
];

describe("noteToShow", () => {
  it("announces the newest release when an older one was last seen", () => {
    expect(noteToShow(notes, "2026-07-20")?.headline).toBe("Newest");
  });

  it("says nothing when the newest release has already been seen", () => {
    expect(noteToShow(notes, "2026-07-26")).toBeNull();
  });

  it("says nothing on a fresh install — there is no 'since last time'", () => {
    expect(noteToShow(notes, undefined)).toBeNull();
  });

  it("says nothing when no notes are authored", () => {
    expect(noteToShow([], "2026-07-20")).toBeNull();
  });
});

describe("versionToRecord", () => {
  it("records the newest version so the NEXT release is announced", () => {
    expect(versionToRecord(notes)).toBe("2026-07-26");
  });

  it("records nothing when no notes exist", () => {
    expect(versionToRecord([])).toBeNull();
  });
});
