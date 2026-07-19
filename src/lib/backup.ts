// One-file backup: build, validate, and restore-by-merge (D-019).
// Depends on: progress-store.ts, srs.ts (types). Depended on by:
// components/backup.tsx, components/home.tsx (reminder).
//
// The export file is the insurance policy against browser data eviction
// (RISKS.md R1) and the laptop↔phone bridge until Stage E sync. Restore
// MERGES (never replaces): attempts union by identity, lesson progress by
// rank, and SRS state is not merged at all — it's rebuilt from the merged
// attempts, because derived state gets recomputed, not reconciled.

import type { AttemptRecord, LessonProgressRecord, ProgressDb } from "./progress-store";
import type { SrsState } from "./srs";

export const BACKUP_FORMAT = "metal-backup";
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  /** Which device wrote this file — for humans reading the JSON. */
  installId: string | null;
  stores: {
    attempts: AttemptRecord[];
    lessonProgress: LessonProgressRecord[];
    /** Included for inspection; restore ignores it and rebuilds (D-019). */
    srsState: SrsState[];
  };
}

export interface RestoreSummary {
  attemptsAdded: number;
  lessonsMerged: number;
}

/** Snapshot the database into a backup object (serialize with JSON.stringify). */
export async function buildBackup(db: ProgressDb): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    installId: (await db.getMeta("installId")) ?? null,
    stores: {
      attempts: await db.allAttempts(),
      lessonProgress: [...(await db.lessonStatuses()).values()],
      srsState: await db.allSrsStates(),
    },
  };
}

/** Throws with a specific reason if `data` is not a usable backup file. */
export function validateBackup(data: unknown): BackupFile {
  const fail = (why: string): never => {
    throw new Error(`Not a valid Metal backup file: ${why}`);
  };
  if (typeof data !== "object" || data === null) fail("not a JSON object");
  const b = data as Record<string, unknown>;
  if (b["format"] !== BACKUP_FORMAT) {
    fail(`format is "${String(b["format"])}", expected "${BACKUP_FORMAT}"`);
  }
  const version = b["schemaVersion"];
  if (typeof version !== "number") return fail("missing schemaVersion");
  if (version < 1) fail("missing schemaVersion");
  if (version > BACKUP_SCHEMA_VERSION) {
    fail(
      `schemaVersion ${version} is newer than this app understands ` +
        `(${BACKUP_SCHEMA_VERSION}) — update the app, then restore`,
    );
  }
  const stores = b["stores"] as Record<string, unknown> | undefined;
  if (!stores || typeof stores !== "object") fail("missing stores");
  if (!Array.isArray(stores!["attempts"])) fail("stores.attempts is not a list");
  if (!Array.isArray(stores!["lessonProgress"])) {
    fail("stores.lessonProgress is not a list");
  }
  const badAttempts = (stores!["attempts"] as unknown[]).filter((a) => {
    const r = a as Record<string, unknown>;
    return (
      typeof r?.["questionId"] !== "string" ||
      typeof r?.["at"] !== "string" ||
      typeof r?.["correct"] !== "boolean"
    );
  }).length;
  if (badAttempts > 0) fail(`${badAttempts} malformed attempt record(s)`);
  return data as BackupFile;
}

/** Merge a validated backup into the database (D-019 rules), rebuild SRS. */
export async function restoreBackup(
  db: ProgressDb,
  backup: BackupFile,
): Promise<RestoreSummary> {
  const attemptsAdded = await db.addAttemptsIfMissing(backup.stores.attempts);

  let lessonsMerged = 0;
  const local = await db.lessonStatuses();
  for (const incoming of backup.stores.lessonProgress) {
    const existing = local.get(incoming.lessonId);
    if (!existing) {
      await db.putLessonProgress(incoming);
      lessonsMerged += 1;
      continue;
    }
    // "done" outranks "in-progress"; two "done"s keep the EARLIER
    // completedAt — the historical first completion.
    const incomingWins =
      (incoming.status === "done" && existing.status !== "done") ||
      (incoming.status === "done" &&
        existing.status === "done" &&
        (incoming.completedAt ?? "") < (existing.completedAt ?? ""));
    if (incomingWins) {
      await db.putLessonProgress(incoming);
      lessonsMerged += 1;
    }
  }

  // Derived state: recompute, never reconcile.
  await db.rebuildSrsFromAttempts();
  return { attemptsAdded, lessonsMerged };
}

/* ---------------- weekly reminder ---------------- */

export interface ReminderState {
  /** True when an export is due (never exported, or older than 7 days). */
  overdue: boolean;
  /** Whole days since the last export; null if never exported. */
  daysSinceExport: number | null;
}

const WEEK_DAYS = 7;

/** Pure rule for the weekly export reminder (BUILD_PLAN Stage B). */
export function exportReminder(
  lastExportAt: string | null,
  hasHistory: boolean,
  now: Date,
): ReminderState {
  if (!hasHistory) return { overdue: false, daysSinceExport: null };
  if (!lastExportAt) return { overdue: true, daysSinceExport: null };
  const days = Math.floor(
    (now.getTime() - new Date(lastExportAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  return { overdue: days >= WEEK_DAYS, daysSinceExport: days };
}
