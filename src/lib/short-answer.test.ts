import { describe, expect, it } from "vitest";
import { matchesAccepted, normalizeAnswer } from "./short-answer";

describe("normalizeAnswer", () => {
  it("ignores case, surrounding whitespace, and internal whitespace runs", () => {
    expect(normalizeAnswer("  Locality  of   Reference ")).toBe("locality of reference");
  });

  it("ignores trailing sentence punctuation but not internal punctuation", () => {
    expect(normalizeAnswer("locality of reference.")).toBe("locality of reference");
    expect(normalizeAnswer("cache-friendly!")).toBe("cache-friendly");
    expect(normalizeAnswer("p99.9 latency")).toBe("p99.9 latency");
  });
});

describe("matchesAccepted", () => {
  const accept = ["locality", "locality of reference"];

  it("accepts an answer matching any accepted form, regardless of case", () => {
    expect(matchesAccepted("Locality", accept)).toBe(true);
    expect(matchesAccepted("locality of reference.", accept)).toBe(true);
  });

  it("rejects answers that only partially match — no fuzzy credit", () => {
    expect(matchesAccepted("spatial locality", accept)).toBe(false);
    expect(matchesAccepted("", accept)).toBe(false);
  });

  it("fails loudly on an empty accept list instead of silently rejecting", () => {
    expect(() => matchesAccepted("anything", [])).toThrow(/empty accept list/);
  });
});
