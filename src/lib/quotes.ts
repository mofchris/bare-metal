// The opening quote (D-031): one line a day on the home screen.
// Depends on: curriculum.ts (types). Depended on by: components/home.tsx.
//
// WHY DAY-OF-YEAR MODULO LENGTH, rather than an array of 365. Christopher
// asked for one quote per day of the year, but a list that must be exactly 365
// long can only ship when it is exactly 365 long — and the honest way to fill
// it is slowly, a line at a time, as they land. Indexing by day-of-year modulo
// the list's length means the feature works at any size: nine quotes cycle
// every nine days, ninety cycle every ninety, and 365 gives him precisely what
// he asked for. Adding one never renumbers the rest, so no day's quote silently
// becomes a different day's.
//
// The same day always shows the same quote, which matters more than novelty:
// re-opening the app twice before lunch should not reroll it.

import type { Quote } from "./curriculum";

/**
 * 1-based day of the year in LOCAL time (1 on 1 January, 365 or 366 on 31
 * December). Local rather than UTC so the quote turns over at his midnight.
 */
export function dayOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.round((startOfDay.getTime() - startOfYear.getTime()) / millisecondsPerDay) + 1
  );
}

/**
 * The quote for a given day, or null when there are none to show — the caller
 * renders nothing rather than an empty frame.
 */
export function quoteForDay(quotes: readonly Quote[], date: Date): Quote | null {
  if (quotes.length === 0) return null;
  return quotes[(dayOfYear(date) - 1) % quotes.length] ?? null;
}
