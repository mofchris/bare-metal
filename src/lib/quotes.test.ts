import { describe, expect, it } from "vitest";
import { dayOfYear, quoteForDay } from "./quotes";
import type { Quote } from "./curriculum";

const quotesOf = (n: number): Quote[] =>
  Array.from({ length: n }, (_, i) => ({
    text: `line ${i}`,
    who: `who ${i}`,
    series: "series",
  }));

describe("dayOfYear", () => {
  it("counts 1 January as day one", () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("counts 31 December as the last day of a common year", () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it("includes the extra day of a leap year", () => {
    expect(dayOfYear(new Date(2028, 11, 31))).toBe(366);
  });

  it("does not shift across a daylight-saving boundary", () => {
    // Built from local calendar parts rather than elapsed milliseconds, so a
    // 23- or 25-hour day cannot round the count off by one.
    const march = dayOfYear(new Date(2026, 2, 30));
    const dayBefore = dayOfYear(new Date(2026, 2, 29));
    expect(march - dayBefore).toBe(1);
  });
});

describe("quoteForDay", () => {
  it("shows the same quote all day, however often the app is opened", () => {
    const quotes = quotesOf(9);
    const morning = new Date(2026, 6, 26, 8, 0, 0);
    const evening = new Date(2026, 6, 26, 22, 30, 0);
    expect(quoteForDay(quotes, morning)).toEqual(quoteForDay(quotes, evening));
  });

  it("moves to a different quote the next day", () => {
    const quotes = quotesOf(9);
    const today = new Date(2026, 6, 26);
    const tomorrow = new Date(2026, 6, 27);
    expect(quoteForDay(quotes, today)).not.toEqual(quoteForDay(quotes, tomorrow));
  });

  it("cycles a short list instead of running out", () => {
    // The whole point of indexing modulo length: the feature works long before
    // the list reaches 365 entries.
    const quotes = quotesOf(3);
    const days = [1, 2, 3, 4].map((d) => quoteForDay(quotes, new Date(2026, 0, d))!.text);
    expect(days).toEqual(["line 0", "line 1", "line 2", "line 0"]);
  });

  it("uses every quote in a list of any length", () => {
    const quotes = quotesOf(9);
    const seen = new Set(
      Array.from(
        { length: 9 },
        (_, i) => quoteForDay(quotes, new Date(2026, 0, i + 1))!.text,
      ),
    );
    expect(seen.size).toBe(9);
  });

  it("returns nothing when no quotes are authored, rather than throwing", () => {
    expect(quoteForDay([], new Date(2026, 6, 26))).toBeNull();
  });
});
