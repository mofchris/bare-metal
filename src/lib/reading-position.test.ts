import { describe, expect, it } from "vitest";
import {
  isResumable,
  offsetForFraction,
  parseStoredFraction,
  readingPositionKey,
  scrollFraction,
} from "./reading-position";

describe("scrollFraction", () => {
  it("reports nothing read at the top and everything read at the bottom", () => {
    expect(scrollFraction(0, 800, 2400)).toBe(0);
    expect(scrollFraction(1600, 800, 2400)).toBe(1);
  });

  it("reports the halfway point as half", () => {
    expect(scrollFraction(800, 800, 2400)).toBe(0.5);
  });

  it("treats a page that fits on screen as fully read", () => {
    // Nothing to scroll: reporting 0 would show an empty bar on a page the
    // reader can see all of at once.
    expect(scrollFraction(0, 800, 600)).toBe(1);
  });

  it("clamps overscroll rather than reporting more than one", () => {
    // iOS rubber-band scrolling reports offsets past the end.
    expect(scrollFraction(2000, 800, 2400)).toBe(1);
    expect(scrollFraction(-50, 800, 2400)).toBe(0);
  });
});

describe("offsetForFraction", () => {
  it("round-trips a fraction back to the offset it came from", () => {
    const offset = offsetForFraction(0.5, 800, 2400);
    expect(offset).toBe(800);
    expect(scrollFraction(offset, 800, 2400)).toBe(0.5);
  });

  it("maps the same fraction to different offsets on different screens", () => {
    // The reason positions are stored as fractions: the same lesson is a
    // different height on a phone than on a laptop.
    const laptop = offsetForFraction(0.5, 800, 2400);
    const phone = offsetForFraction(0.5, 700, 5200);
    expect(laptop).not.toBe(phone);
    expect(scrollFraction(phone, 700, 5200)).toBe(0.5);
  });

  it("never returns a negative offset for a page that fits on screen", () => {
    expect(offsetForFraction(0.5, 800, 600)).toBe(0);
  });
});

describe("isResumable", () => {
  it("offers to resume from the middle of a lesson", () => {
    expect(isResumable(0.4)).toBe(true);
  });

  it("does not offer to resume from the first few lines", () => {
    expect(isResumable(0.02)).toBe(false);
  });

  it("does not fling the reader to the end of a lesson they finished", () => {
    expect(isResumable(0.98)).toBe(false);
  });

  it("offers nothing when the lesson has never been opened", () => {
    expect(isResumable(null)).toBe(false);
  });
});

describe("parseStoredFraction", () => {
  it("reads back a stored position", () => {
    expect(parseStoredFraction("0.42")).toBe(0.42);
  });

  it("treats an absent position as no position", () => {
    expect(parseStoredFraction(undefined)).toBeNull();
  });

  it("rejects corrupted values rather than scrolling somewhere absurd", () => {
    expect(parseStoredFraction("banana")).toBeNull();
    expect(parseStoredFraction("-3")).toBeNull();
    expect(parseStoredFraction("42")).toBeNull();
  });
});

describe("readingPositionKey", () => {
  it("keys positions per lesson so they cannot overwrite each other", () => {
    expect(readingPositionKey("m1/01-memory-hierarchy")).not.toBe(
      readingPositionKey("m1/02-cpu-architecture"),
    );
  });
});
