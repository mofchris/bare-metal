// Account + sync section for the Backup page (D-022): sign in / create an
// account (username + 6-digit PIN, shared with the GRE and Network+ sims),
// sync status, manual sync. Depends on: lib/sync, lib/progress-store.
// Depended on by: components/backup.tsx.
//
// Turnstile is the one external script in the app (auth inherently needs
// network; studying never does — D-022 records the exception). It loads
// lazily, only when this form is shown.

import { useEffect, useRef, useState } from "preact/hooks";
import {
  clearAuth,
  getAuth,
  login,
  signup,
  syncNow,
  TURNSTILE_SITE_KEY,
  type AuthState,
} from "../lib/sync";
import type { ProgressDb } from "../lib/progress-store";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; theme?: string },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

let turnstileLoader: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileLoader) {
    turnstileLoader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error("couldn't load the verification widget — are you online?"));
      document.head.appendChild(s);
    });
  }
  return turnstileLoader;
}

export function Account({ db }: { db: ProgressDb | null }) {
  const [auth, setAuthState] = useState<AuthState | null>(() => getAuth());
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetRendered = useRef(false);

  useEffect(() => {
    if (!db) return;
    db.getMeta("lastSyncAt")
      .then((v) => setLastSyncAt(v ?? null))
      .catch(() => setLastSyncAt(null));
  }, [db, auth]);

  // Render the Turnstile widget whenever the signed-out form is visible.
  useEffect(() => {
    if (auth || widgetRendered.current || !widgetRef.current) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !widgetRef.current || !window.turnstile) return;
        widgetRendered.current = true;
        window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token) => setCaptchaToken(token),
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const runSync = async (current: AuthState) => {
    if (!db) return;
    setNotice("syncing…");
    const result = await syncNow(db, current);
    if (result.signedOut) {
      setAuthState(null);
      widgetRendered.current = false;
    }
    setNotice(result.detail);
    const t = await db.getMeta("lastSyncAt").catch(() => undefined);
    setLastSyncAt(t ?? null);
  };

  const submit = async (mode: "login" | "signup") => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result =
        mode === "signup"
          ? await signup(username.trim(), pin, captchaToken ?? "")
          : await login(username.trim(), pin, captchaToken ?? undefined);
      if (!result.ok) {
        setError(
          result.needsCaptcha && !captchaToken
            ? "complete the verification box first"
            : (result.error ?? "failed"),
        );
        return;
      }
      if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
      const current = getAuth();
      setAuthState(current);
      if (current) await runSync(current);
    } finally {
      setBusy(false);
    }
  };

  if (!db) return null;

  return (
    <section>
      <h3 class="dash-section">Cross-device sync</h3>
      {auth ? (
        <div>
          <p>
            Signed in as <strong>{auth.username}</strong> — progress syncs across every
            device using this account (Metal, GRE, and Network+ share it).
          </p>
          <p class="lesson-meta">
            {lastSyncAt
              ? `Last sync: ${new Date(lastSyncAt).toLocaleString()}`
              : "Not synced yet on this device."}
            {notice ? ` · ${notice}` : ""}
          </p>
          <p class="quiz-actions">
            <button class="btn" disabled={busy} onClick={() => void runSync(auth)}>
              Sync now
            </button>
            <button
              class="btn-quiet"
              onClick={() => {
                clearAuth();
                setAuthState(null);
                widgetRendered.current = false;
                setNotice(null);
              }}
            >
              Sign out
            </button>
          </p>
        </div>
      ) : (
        <div>
          <p class="lesson-meta">
            One account keeps progress in step across your laptop and phone. Same username
            and PIN as your GRE and Network+ sims.
          </p>
          <div class="account-form">
            <input
              type="text"
              placeholder="username"
              autocomplete="username"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="6-digit PIN"
              autocomplete="current-password"
              value={pin}
              onInput={(e) => setPin((e.target as HTMLInputElement).value)}
            />
          </div>
          <div ref={widgetRef} class="turnstile-slot" />
          <p class="quiz-actions">
            <button class="btn" disabled={busy} onClick={() => void submit("login")}>
              Sign in
            </button>
            <button
              class="btn-quiet"
              disabled={busy}
              onClick={() => void submit("signup")}
            >
              Create account
            </button>
          </p>
        </div>
      )}
      {recoveryCode && (
        <p class="warn-banner">
          Your recovery code is <strong class="mono">{recoveryCode}</strong> — write it
          down now. It is shown exactly once and is the only way to reset a forgotten PIN.
        </p>
      )}
      {error && <p class="quiz-note-warn">{error}</p>}
      {!auth && notice && <p class="quiz-note">{notice}</p>}
    </section>
  );
}
