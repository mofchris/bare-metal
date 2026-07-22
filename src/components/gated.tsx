// Route guard for gated content (D-023): loads progress, runs the given
// check, and either renders the screen or says exactly what unlocks it.
// Depends on: lib/progress-store. Depended on by: app.tsx.
//
// Home already hides locked links; this guard covers direct URLs and the
// in-lesson "Next" link. With no storage available (db null) gating can't be
// evaluated, so content stays open — a browsing-only session shouldn't brick
// on a lock it can't track.
//
// gateKey identifies WHICH screen the current verdict belongs to. It exists
// because this component stays mounted across lesson→lesson navigation: keying
// the re-check on `db` alone left the previous lesson's "open" verdict in
// place, which let the lesson footer's Next link walk straight past a lock
// without taking the quiz. The verdict is now discarded the moment the key
// changes, so a stale "open" can never render the new screen.

import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type {
  ExamResultRecord,
  LessonProgressRecord,
  ProgressDb,
} from "../lib/progress-store";

type GateState =
  | { status: "checking" }
  | { status: "open" }
  | { status: "locked"; reason: string }
  | { status: "error"; message: string };

/** A verdict is only trusted for the screen it was computed for. */
export type Verdict = { key: string; state: GateState };

/**
 * The state to render for `gateKey`, given the last verdict we computed.
 *
 * Pure, exported, and tested because this is exactly where the gating bypass
 * lived: a verdict computed for the previous lesson must NEVER be treated as
 * an answer about this one, or the lesson footer's Next link walks past a
 * lock without the quiz. Unknown screen ⇒ "checking", never "open".
 */
export function stateFor(verdict: Verdict | null, gateKey: string): GateState {
  if (!verdict || verdict.key !== gateKey) return { status: "checking" };
  return verdict.state;
}

export function Gated({
  db,
  gateKey,
  check,
  children,
}: {
  db: ProgressDb | null;
  /** Identifies the guarded screen, e.g. "lesson:m1/02-cpu-architecture". */
  gateKey: string;
  /** Returns null when open, or a human reason when locked. */
  check: (
    statuses: Map<string, LessonProgressRecord>,
    exams: Map<string, ExamResultRecord>,
  ) => string | null;
  children: ComponentChildren | ((progress: GateProgress) => ComponentChildren);
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [progress, setProgress] = useState<GateProgress | null>(null);

  useEffect(() => {
    if (!db) {
      setVerdict({ key: gateKey, state: { status: "open" } });
      return;
    }
    let current = true;
    Promise.all([db.lessonStatuses(), db.examResults()])
      .then(([statuses, exams]) => {
        if (!current) return; // a newer navigation already superseded this one
        const reason = check(statuses, exams);
        setProgress({ statuses, exams });
        setVerdict({
          key: gateKey,
          state: reason === null ? { status: "open" } : { status: "locked", reason },
        });
      })
      .catch((e: unknown) => {
        if (!current) return;
        setVerdict({
          key: gateKey,
          state: {
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          },
        });
      });
    return () => {
      current = false;
    };
  }, [db, gateKey]);

  // Derived during render, not stored: a verdict computed for a different
  // screen is not an answer about this one, so we are back to "checking".
  const state = stateFor(verdict, gateKey);

  if (state.status === "checking") return <p class="status">Checking progress…</p>;
  if (state.status === "error") {
    return (
      <div class="error-block">
        <h2>Couldn't check progress</h2>
        <p>{state.message}</p>
      </div>
    );
  }
  if (state.status === "locked") {
    return (
      <div>
        <nav class="crumbs">
          <a href="#/">← Home</a>
        </nav>
        <h2>Locked</h2>
        <p>{state.reason}</p>
      </div>
    );
  }
  return <>{typeof children === "function" ? children(progress ?? EMPTY) : children}</>;
}

/** Progress handed to render-prop children so they can gate their own links. */
export type GateProgress = {
  statuses: Map<string, LessonProgressRecord>;
  exams: Map<string, ExamResultRecord>;
};

// Storage unavailable: no records to reason about, and the gate is open
// anyway, so children see empty maps rather than a null they must handle.
const EMPTY: GateProgress = { statuses: new Map(), exams: new Map() };
