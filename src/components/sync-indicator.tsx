// Header sync chip (mirrors the GRE/Net+ sims' indicator): who's signed in
// and where sync stands, always one glance away. Links to the Sync page.
// Depends on: lib/sync, lib/progress-store. Depended on by: app.tsx.

import { useEffect, useState } from "preact/hooks";
import { getAuth, SYNC_EVENT, type AuthState, type SyncEventDetail } from "../lib/sync";
import type { ProgressDb } from "../lib/progress-store";

function relative(iso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SyncIndicator({ db }: { db: ProgressDb | null }) {
  const [auth, setAuth] = useState<AuthState | null>(() => getAuth());
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "syncing" | "error">("idle");
  const [, bumpClock] = useState(0); // re-render so "2m ago" stays honest

  useEffect(() => {
    if (!db) return;
    const refresh = () => {
      setAuth(getAuth());
      db.getMeta("lastSyncAt")
        .then((v) => setLastSyncAt(v ?? null))
        .catch(() => setLastSyncAt(null));
    };
    refresh();
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<SyncEventDetail>).detail;
      if (detail.phase === "start") {
        setPhase("syncing");
      } else {
        setPhase(detail.result.ok ? "idle" : "error");
        refresh();
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    const clock = setInterval(() => bumpClock((n) => n + 1), 60_000);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      clearInterval(clock);
    };
  }, [db]);

  if (!db) return null;

  if (!auth) {
    return (
      <a class="sync-chip signed-out" href="#/backup" title="Set up cross-device sync">
        <span class="sync-dot" />
        not synced
      </a>
    );
  }

  const status =
    phase === "syncing"
      ? "syncing…"
      : phase === "error"
        ? "sync failed"
        : lastSyncAt
          ? relative(lastSyncAt, new Date())
          : "not synced yet";

  return (
    <a
      class={`sync-chip${phase === "error" ? " error" : ""}`}
      href="#/backup"
      title={
        lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleString()}` : "Open sync"
      }
    >
      <span class="sync-dot" />
      {auth.username} · {status}
    </a>
  );
}
