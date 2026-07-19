// Route guard for gated content (D-023): loads progress, runs the given
// check, and either renders the screen or says exactly what unlocks it.
// Depends on: lib/progress-store. Depended on by: app.tsx.
//
// Home already hides locked links; this guard covers direct URLs. With no
// storage available (db null) gating can't be evaluated, so content stays
// open — a browsing-only session shouldn't brick on a lock it can't track.

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

export function Gated({
  db,
  check,
  children,
}: {
  db: ProgressDb | null;
  /** Returns null when open, or a human reason when locked. */
  check: (
    statuses: Map<string, LessonProgressRecord>,
    exams: Map<string, ExamResultRecord>,
  ) => string | null;
  children: ComponentChildren;
}) {
  const [state, setState] = useState<GateState>({
    status: db ? "checking" : "open",
  });

  useEffect(() => {
    if (!db) return;
    Promise.all([db.lessonStatuses(), db.examResults()])
      .then(([statuses, exams]) => {
        const reason = check(statuses, exams);
        setState(reason === null ? { status: "open" } : { status: "locked", reason });
      })
      .catch((e: unknown) =>
        setState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  }, [db]);

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
  return <>{children}</>;
}
