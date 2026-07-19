// Short-answer grading primitives. Depends on: nothing. Depended on by: the
// quiz engine (later in Stage A).
//
// Grading model (from docs/DATA_MODEL.md): a short-answer question carries an
// `accept` list; the student's response matches if its normalized form equals
// any normalized accepted answer. Normalization is deliberately conservative —
// case, whitespace, and trailing punctuation only. No stemming or fuzzy
// matching: a grader that guesses is worse than one that occasionally makes
// you retype, because wrong "correct" marks poison the spaced-repetition
// history (RISKS.md R4).

/** Lowercase, trim, collapse internal whitespace, drop trailing punctuation. */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
}

/** True if `response` matches any entry in `accept` after normalization. */
export function matchesAccepted(response: string, accept: readonly string[]): boolean {
  if (accept.length === 0) {
    // An empty accept list is authoring error the content compiler should
    // have rejected; failing loudly here catches it if it slips through.
    throw new Error("matchesAccepted: empty accept list — malformed question");
  }
  const normalized = normalizeAnswer(response);
  return accept.some((a) => normalizeAnswer(a) === normalized);
}
