// Progress persistence: the IndexedDB layer (database "metal-progress").
// Depends on: idb (D-007). Depended on by: app.tsx, components/quiz.tsx,
// components/home.tsx, and (Stage B) the dashboard + export/restore.
//
// Design rules from docs/DATA_MODEL.md:
// - `attempts` is APPEND-ONLY ground truth. Every answer is written the
//   moment it is graded — never batched at quiz end — so killing the app
//   mid-quiz loses nothing (Gate A test). Dashboard numbers and SRS state
//   are derived and can always be recomputed from this store.
// - `lessonProgress` is keyed by lessonId; "not-started" is represented by
//   absence, so the store only ever holds "in-progress" and "done" rows.
// - `srsState` (schema v2) is DERIVED state: it can always be rebuilt by
//   replaying `attempts` through the SRS engine, and the v1→v2 migration does
//   exactly that (see rebuildSrsFromAttempts).
// - Stage C's labResults store is NOT pre-created: IndexedDB versioned
//   upgrades exist exactly for adding stores when their stage lands.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { updateSrs, type SrsState } from "./srs";

export interface AttemptRecord {
  questionId: string;
  at: string; // ISO timestamp
  correct: boolean;
  /** What the student actually entered: option text for MCQ, raw text for short. */
  givenAnswer: string;
  /** Groups the attempts of one quiz run (crypto.randomUUID per run). */
  sessionId: string;
}

export interface LessonProgressRecord {
  lessonId: string;
  status: "in-progress" | "done";
  completedAt?: string;
}

interface MetalDBSchema extends DBSchema {
  attempts: {
    key: number; // auto-increment
    value: AttemptRecord;
    indexes: { "by-question": string };
  };
  lessonProgress: { key: string; value: LessonProgressRecord };
  srsState: { key: string; value: SrsState }; // keyed by questionId
  meta: { key: string; value: string };
}

const SCHEMA_VERSION = 2;

/** Open (and on first run, create/migrate) the progress database. */
export async function openProgressDb(name = "metal-progress"): Promise<ProgressDb> {
  let needsSrsRebuild = false;
  const db = await openDB<MetalDBSchema>(name, SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const attempts = db.createObjectStore("attempts", { autoIncrement: true });
        attempts.createIndex("by-question", "questionId");
        db.createObjectStore("lessonProgress", { keyPath: "lessonId" });
        db.createObjectStore("meta");
      }
      if (oldVersion < 2) {
        db.createObjectStore("srsState", { keyPath: "questionId" });
        // Existing attempt history (v1 installs) must seed the schedule;
        // flagged here, replayed after open (the upgrade tx can't await).
        needsSrsRebuild = oldVersion >= 1;
      }
    },
  });
  // installId identifies this browser profile in Stage B export files, so a
  // restore can tell "my laptop" from "my phone" history. Set once, ever.
  if ((await db.get("meta", "installId")) === undefined) {
    await db.put("meta", crypto.randomUUID(), "installId");
  }
  const store = new ProgressDb(db);
  if (needsSrsRebuild) await store.rebuildSrsFromAttempts();
  return store;
}

export class ProgressDb {
  constructor(private readonly db: IDBPDatabase<MetalDBSchema>) {}

  async recordAttempt(attempt: AttemptRecord): Promise<void> {
    await this.db.add("attempts", attempt);
  }

  async allAttempts(): Promise<AttemptRecord[]> {
    return this.db.getAll("attempts");
  }

  async attemptsForQuestion(questionId: string): Promise<AttemptRecord[]> {
    return this.db.getAllFromIndex("attempts", "by-question", questionId);
  }

  async setLessonStatus(
    lessonId: string,
    status: LessonProgressRecord["status"],
  ): Promise<void> {
    const record: LessonProgressRecord = { lessonId, status };
    if (status === "done") record.completedAt = new Date().toISOString();
    await this.db.put("lessonProgress", record);
  }

  async lessonStatuses(): Promise<Map<string, LessonProgressRecord>> {
    const all = await this.db.getAll("lessonProgress");
    return new Map(all.map((r) => [r.lessonId, r]));
  }

  /* ---------------- spaced repetition ---------------- */

  /** Fold one graded answer into the question's schedule (called per answer). */
  async updateSrsOnAnswer(
    questionId: string,
    correct: boolean,
    now: Date,
  ): Promise<void> {
    const previous = (await this.db.get("srsState", questionId)) ?? null;
    await this.db.put("srsState", updateSrs(previous, questionId, correct, now));
  }

  async allSrsStates(): Promise<SrsState[]> {
    return this.db.getAll("srsState");
  }

  /**
   * Derive the whole srsState store from attempt history (v1→v2 migration,
   * and the restore path later): replay every attempt in time order through
   * the engine. Idempotent — the result depends only on `attempts`.
   */
  async rebuildSrsFromAttempts(): Promise<void> {
    const attempts = await this.allAttempts();
    attempts.sort((a, b) => a.at.localeCompare(b.at));
    const states = new Map<string, SrsState>();
    for (const attempt of attempts) {
      states.set(
        attempt.questionId,
        updateSrs(
          states.get(attempt.questionId) ?? null,
          attempt.questionId,
          attempt.correct,
          new Date(attempt.at),
        ),
      );
    }
    const tx = this.db.transaction("srsState", "readwrite");
    await tx.store.clear();
    for (const state of states.values()) await tx.store.put(state);
    await tx.done;
  }

  close(): void {
    this.db.close();
  }
}
