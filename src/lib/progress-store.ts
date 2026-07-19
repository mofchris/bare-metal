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
// - Stage B/C stores (srsState, labResults) are NOT pre-created: IndexedDB
//   versioned upgrades exist exactly for adding stores when their stage lands.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

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
  meta: { key: string; value: string };
}

const SCHEMA_VERSION = 1;

/** Open (and on first run, create) the progress database. */
export async function openProgressDb(name = "metal-progress"): Promise<ProgressDb> {
  const db = await openDB<MetalDBSchema>(name, SCHEMA_VERSION, {
    upgrade(db) {
      const attempts = db.createObjectStore("attempts", { autoIncrement: true });
      attempts.createIndex("by-question", "questionId");
      db.createObjectStore("lessonProgress", { keyPath: "lessonId" });
      db.createObjectStore("meta");
    },
  });
  // installId identifies this browser profile in Stage B export files, so a
  // restore can tell "my laptop" from "my phone" history. Set once, ever.
  if ((await db.get("meta", "installId")) === undefined) {
    await db.put("meta", crypto.randomUUID(), "installId");
  }
  return new ProgressDb(db);
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

  close(): void {
    this.db.close();
  }
}
