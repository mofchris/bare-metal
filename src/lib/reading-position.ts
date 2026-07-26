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

/** Meta-store key holding the lesson he was last reading, and how far in.
    Stored as "<lessonId>|<fraction>" — one row rather than two, so the pair
    can never be read half-updated. */
export const LAST_READ_KEY = "lastReadLesson";

/** Parse LAST_READ_KEY's value; null if absent or malformed. */
export function parseLastRead(
  raw: string | undefined,
): { lessonId: string; fraction: number } | null {
  if (raw === undefined) return null;
  const separator = raw.lastIndexOf("|");
  if (separator <= 0) return null;
  const lessonId = raw.slice(0, separator);
  const fraction = parseStoredFraction(raw.slice(separator + 1));
  if (fraction === null) return null;
  return { lessonId, fraction };
}

/** Serialise for LAST_READ_KEY. */
export function formatLastRead(lessonId: string, fraction: number): string {
  return `${lessonId}|${fraction}`;
}

/**
 * A one-shot handoff: Home sets this when he clicks "pick up where you left
 * off", and the lesson screen consumes it to scroll straight there instead of
 * showing its own prompt. sessionStorage rather than a route parameter so the
 * URL stays shareable and re-opening the lesson later does not re-trigger it.
 */
const RESUME_INTENT_KEY = "metal:resumeIntent";

export function requestResume(lessonId: string): void {
  try {
    sessionStorage.setItem(RESUME_INTENT_KEY, lessonId);
  } catch {
    // Private modes can refuse sessionStorage; the lesson then simply offers
    // its normal prompt, which is a fine fallback.
  }
}

/** True once, if a resume was requested for this lesson. Clears the flag. */
export function consumeResumeIntent(lessonId: string): boolean {
  try {
    const wanted = sessionStorage.getItem(RESUME_INTENT_KEY);
    if (wanted !== lessonId) return false;
    sessionStorage.removeItem(RESUME_INTENT_KEY);
    return true;
  } catch {
    return false;
  }
}

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
