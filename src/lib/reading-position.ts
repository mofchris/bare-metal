// Reading position (D-035): how far through a lesson you are, and where to
// pick up next time.
// Depends on: nothing. Depended on by: components/lesson-view.tsx.
//
// Positions are stored as a FRACTION of the scrollable height, never as a
// pixel offset. Christopher reads the same lesson on a laptop and an iPhone,
// where the identical prose reflows to wildly different heights — a pixel
// offset saved on one is meaningless on the other. A fraction survives the
// move, and survives small content edits approximately, which is the best that
// is honestly available.
//
// The meta store already holds arbitrary key/value strings, so this needs no
// new object store and no schema version bump (same reasoning as D-029).

/** Meta-store key holding the reading position for one lesson. */
export function readingPositionKey(lessonId: string): string {
  return `readingPosition:${lessonId}`;
}

/**
 * A position at or past this fraction counts as "you finished it". Restoring
 * someone to the very bottom of a lesson they already read to the end is worse
 * than useless — they came back to reread from the top.
 */
export const FINISHED_FRACTION = 0.95;

/**
 * How far down a scrollable page a given scroll offset is, as 0..1.
 * A page shorter than the viewport has nothing to scroll, and is reported as 1
 * (fully read) rather than 0 or NaN — you can see all of it at once.
 */
export function scrollFraction(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
): number {
  const scrollable = documentHeight - viewportHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

/** The scroll offset a saved fraction corresponds to on the current layout. */
export function offsetForFraction(
  fraction: number,
  viewportHeight: number,
  documentHeight: number,
): number {
  return Math.max(0, (documentHeight - viewportHeight) * fraction);
}

/**
 * Should a saved position be offered as "resume where you left off"?
 *
 * No for a position near the top (nothing was lost, and an offer to jump three
 * paragraphs in is noise) and no for a finished lesson (see FINISHED_FRACTION).
 */
export function isResumable(fraction: number | null): boolean {
  if (fraction === null) return false;
  return fraction > 0.05 && fraction < FINISHED_FRACTION;
}

/** Parse a stored position string; null if absent or malformed. */
export function parseStoredFraction(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  // A corrupted value must not silently scroll the reader somewhere absurd.
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}
