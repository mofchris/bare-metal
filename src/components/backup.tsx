// Backup screen: export the one-file backup, restore one by merge, and show
// when the last export happened. Depends on: lib/backup, lib/progress-store.
// Depended on by: app.tsx.

import { useEffect, useState } from "preact/hooks";
import {
  buildBackup,
  restoreBackup,
  validateBackup,
  type RestoreSummary,
} from "../lib/backup";
import { localDateKey } from "../lib/stats";
import type { ProgressDb } from "../lib/progress-store";

export function Backup({ db }: { db: ProgressDb | null }) {
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    db.getMeta("lastExportAt")
      .then((v) => setLastExportAt(v ?? null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [db]);

  if (!db) {
    return (
      <p class="quiz-note-warn">
        Backup needs progress storage, which is unavailable in this browser.
      </p>
    );
  }

  const doExport = async () => {
    setError(null);
    setMessage(null);
    try {
      const backup = await buildBackup(db);
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `metal-backup-${localDateKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      const now = new Date().toISOString();
      await db.setMeta("lastExportAt", now);
      setLastExportAt(now);
      setMessage(
        `Exported ${backup.stores.attempts.length} attempts and ` +
          `${backup.stores.lessonProgress.length} lesson records.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doRestore = async (file: File) => {
    setError(null);
    setMessage(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const summary: RestoreSummary = await restoreBackup(db, validateBackup(parsed));
      setMessage(
        `Restore merged: ${summary.attemptsAdded} new attempts, ` +
          `${summary.lessonsMerged} lesson records updated. ` +
          `Review schedule rebuilt from the merged history.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <nav class="crumbs">
        <a href="#/">← All modules</a>
      </nav>
      <h2>Backup</h2>
      <p>
        Browsers can evict local data without asking — the backup file is the insurance
        policy, and the way progress moves between laptop and phone.
      </p>

      <section>
        <h3 class="dash-section">Export</h3>
        <p class="lesson-meta">
          {lastExportAt
            ? `Last export: ${new Date(lastExportAt).toLocaleString()}`
            : "Never exported on this device."}
        </p>
        <p>
          <button class="btn" onClick={doExport}>
            Export backup file
          </button>
        </p>
      </section>

      <section>
        <h3 class="dash-section">Restore</h3>
        <p class="lesson-meta">
          Merges the file into this device's history — nothing local is deleted or
          overwritten. Safe to restore the same file twice.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void doRestore(file);
          }}
        />
      </section>

      {message && <p class="quiz-note">{message}</p>}
      {error && <p class="warn-banner">Backup error: {error}</p>}
    </div>
  );
}
