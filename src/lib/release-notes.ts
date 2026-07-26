// What changed since you last opened the app (D-032).
// Depends on: curriculum.ts (types). Depended on by: components/home.tsx.
//
// WHY THIS EXISTS. Metal is an installed PWA that updates silently in the
// background, so behaviour can change under Christopher between one open and
// the next with nothing on screen to say so. That is precisely how the "why am
// I getting the same quiz questions" report happened: the answer had changed
// weeks earlier and the app never mentioned it.
//
// WHAT IT DELIBERATELY DOES NOT DO. It never fires on a fresh install — there
// is no "since last time" for someone opening the app for the first time, and
// a changelog is a poor first impression. It also covers behaviour changes
// only, never content edits: authoring touches the curriculum most days, and a
// notice that appears most days is one that gets dismissed unread.

import type { ReleaseNote } from "./curriculum";

/** Meta-store key holding the newest release version already shown. */
export const RELEASE_NOTES_SEEN_KEY = "releaseNotesSeenVersion";

/**
 * The note to show, or null for nothing.
 *
 * `seenVersion` is the value stored from a previous visit: undefined means
 * this browser has never recorded one, which is either a fresh install or an
 * install from before this feature existed. Both are treated the same way —
 * show nothing, and let the caller record the current version so the NEXT
 * release is announced properly.
 */
export function noteToShow(
  notes: readonly ReleaseNote[],
  seenVersion: string | undefined,
): ReleaseNote | null {
  const newest = notes[0];
  if (newest === undefined) return null;
  if (seenVersion === undefined) return null;
  return newest.version === seenVersion ? null : newest;
}

/** The version to record as seen, or null when there is nothing to record. */
export function versionToRecord(notes: readonly ReleaseNote[]): string | null {
  return notes[0]?.version ?? null;
}
