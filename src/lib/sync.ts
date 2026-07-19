// Cross-device sync client for the study-sync Worker (D-022).
// Depends on: backup.ts (blob build/validate/merge), progress-store.ts.
// Depended on by: app.tsx (boot + interval), components/backup.tsx (UI).
//
// Protocol: the backup file IS the sync blob. syncNow pulls the server blob,
// merges it into local (D-019 rules — idempotent, nothing local is lost),
// pushes the merged snapshot with the server's updatedAt as a
// compare-and-swap base, and retries once on conflict. A PUT is skipped when
// the stores are byte-identical to the server's, so quiet periods cost the
// Worker no writes. Failures degrade to messages, never to blocked studying.

import { buildBackup, restoreBackup, validateBackup, type BackupFile } from "./backup";
import type { ProgressDb } from "./progress-store";

/** Ground-truth stores only: srsState is derived (rebuilt on every restore),
    so including it would manufacture spurious "changed" states. */
const comparable = (stores: BackupFile["stores"]): string =>
  JSON.stringify({
    attempts: stores.attempts,
    lessonProgress: stores.lessonProgress,
    examResults: stores.examResults ?? [],
    studyTime: stores.studyTime ?? [],
  });

const IS_PROD =
  typeof location !== "undefined" && location.hostname === "mofchris.github.io";
export const WORKER_URL = IS_PROD
  ? "https://study-sync.mofchris.workers.dev"
  : "http://localhost:8787"; // local worker during dev; prod CORS only allows the live origin
export const TURNSTILE_SITE_KEY = IS_PROD
  ? "0x4AAAAAAD0g5yt6l-g7L7_h"
  : "1x00000000000000000000AA"; // Cloudflare's always-pass test key

// Same key as the GRE and Network+ sims (same origin): one account, three apps.
const AUTH_KEY = "study-sync-auth";
const APP_ID = "metal";

export interface AuthState {
  token: string;
  username: string;
}

// localStorage is absent under Node (tests); auth is then simply "none".
const storage = typeof localStorage !== "undefined" ? localStorage : null;

export function getAuth(): AuthState | null {
  try {
    const raw = storage?.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState): void {
  storage?.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  storage?.removeItem(AUTH_KEY);
}

interface ApiResult {
  status: number; // 0 = network failure (offline is a state, not an exception)
  body: Record<string, unknown>;
}

async function request(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const init: RequestInit = { method, headers: {} as Record<string, string> };
  const headers = init.headers as Record<string, string>;
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(WORKER_URL + path, init);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsCaptcha?: boolean;
  /** Returned exactly once, on signup — the user must save it. */
  recoveryCode?: string;
}

export async function signup(
  username: string,
  pin: string,
  turnstileToken: string,
): Promise<AuthResult> {
  const res = await request("POST", "/signup", {
    body: { username, pin, turnstile: turnstileToken },
  });
  if (res.status === 200 && typeof res.body["token"] === "string") {
    setAuth({ token: res.body["token"], username: String(res.body["username"]) });
    return { ok: true, recoveryCode: String(res.body["recoveryCode"] ?? "") };
  }
  return failureOf(res);
}

export async function login(
  username: string,
  pin: string,
  turnstileToken?: string,
): Promise<AuthResult> {
  const res = await request("POST", "/login", {
    body: { username, pin, ...(turnstileToken ? { turnstile: turnstileToken } : {}) },
  });
  if (res.status === 200 && typeof res.body["token"] === "string") {
    setAuth({ token: res.body["token"], username: String(res.body["username"]) });
    return { ok: true };
  }
  return failureOf(res);
}

function failureOf(res: ApiResult): AuthResult {
  if (res.status === 0) return { ok: false, error: "offline — try again with internet" };
  const error = typeof res.body["error"] === "string" ? res.body["error"] : "failed";
  return {
    ok: false,
    error:
      error === "invalid_credentials"
        ? "wrong username or PIN"
        : error === "rate_limited"
          ? "too many attempts — wait a bit and retry"
          : error,
    needsCaptcha: res.body["needsCaptcha"] === true,
  };
}

export interface SyncResult {
  ok: boolean;
  detail: string;
  /** True when the token was rejected — the UI should ask to sign in again. */
  signedOut?: boolean;
}

/** Header indicator + Backup page both listen for this window event; syncNow
    emits it at start and finish so every sync path feeds the UI. */
export const SYNC_EVENT = "metal:sync";
export type SyncEventDetail = { phase: "start" } | { phase: "done"; result: SyncResult };

function emitSync(detail: SyncEventDetail): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
  }
}

/** Pull → merge → push (skip if identical) → retry once on conflict. */
export async function syncNow(db: ProgressDb, auth: AuthState): Promise<SyncResult> {
  emitSync({ phase: "start" });
  const result = await syncInner(db, auth);
  emitSync({ phase: "done", result });
  return result;
}

async function syncInner(db: ProgressDb, auth: AuthState): Promise<SyncResult> {
  const pull = await request("GET", `/progress?app=${APP_ID}`, { token: auth.token });
  if (pull.status === 0) return { ok: false, detail: "offline — will sync when online" };
  if (pull.status === 401) {
    clearAuth();
    return { ok: false, detail: "session expired — sign in again", signedOut: true };
  }
  if (pull.status !== 200) {
    return { ok: false, detail: `server error (${pull.status})` };
  }

  const serverBlob = pull.body["blob"];
  let base = typeof pull.body["updatedAt"] === "number" ? pull.body["updatedAt"] : 0;

  if (typeof serverBlob === "string") {
    try {
      await restoreBackup(db, validateBackup(JSON.parse(serverBlob)));
    } catch (e) {
      // A bad server blob must be visible, but local data is intact and the
      // push below will replace it with a good snapshot.
      console.error("Metal: server sync blob was invalid, overwriting", e);
    }
  }

  const push = async (baseUpdatedAt: number) => {
    const local = await buildBackup(db);
    if (typeof serverBlob === "string") {
      try {
        const server = validateBackup(JSON.parse(serverBlob));
        if (comparable(server.stores) === comparable(local.stores)) {
          await db.setMeta("lastSyncAt", new Date().toISOString());
          return { ok: true, detail: "up to date" };
        }
      } catch {
        // fall through to PUT
      }
    }
    return request("PUT", `/progress?app=${APP_ID}`, {
      token: auth.token,
      body: { blob: JSON.stringify(local), baseUpdatedAt },
    }).then(async (res): Promise<SyncResult> => {
      if (res.status === 200) {
        await db.setMeta("lastSyncAt", new Date().toISOString());
        return { ok: true, detail: "synced" };
      }
      if (res.status === 409) return { ok: false, detail: "conflict" };
      if (res.status === 0)
        return { ok: false, detail: "offline — will sync when online" };
      const err = typeof res.body["error"] === "string" ? res.body["error"] : "";
      return { ok: false, detail: `push failed (${res.status}${err ? ` ${err}` : ""})` };
    });
  };

  let result = await push(base);
  if (!result.ok && result.detail === "conflict") {
    // Someone else wrote between our GET and PUT: pull their state, merge,
    // and try exactly once more.
    const again = await request("GET", `/progress?app=${APP_ID}`, { token: auth.token });
    if (again.status === 200 && typeof again.body["blob"] === "string") {
      try {
        await restoreBackup(db, validateBackup(JSON.parse(again.body["blob"] as string)));
      } catch (e) {
        console.error("Metal: conflict blob was invalid, overwriting", e);
      }
      base = typeof again.body["updatedAt"] === "number" ? again.body["updatedAt"] : 0;
      result = await push(base);
    }
  }
  return result;
}
