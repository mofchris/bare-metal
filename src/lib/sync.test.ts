import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBackup } from "./backup";
import { openProgressDb, type AttemptRecord } from "./progress-store";
import { syncNow } from "./sync";

const freshName = () => `test-${crypto.randomUUID()}`;
const auth = { token: "tok", username: "chris" };

const attempt = (questionId: string, at: string): AttemptRecord => ({
  questionId,
  at,
  correct: true,
  givenAnswer: "x",
  sessionId: "s1",
});

type Reply = { status: number; body: unknown };
function mockFetch(script: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const reply = script.shift() ?? { status: 500, body: {} };
      return {
        status: reply.status,
        json: async () => reply.body,
      } as Response;
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("syncNow", () => {
  it("merges the server blob into local, then pushes the merged snapshot", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt("m1/q-001", "2026-07-19T10:00:00.000Z"));

    const serverDb = await openProgressDb(freshName());
    await serverDb.recordAttempt(attempt("m1/q-002", "2026-07-18T10:00:00.000Z"));
    const serverBlob = JSON.stringify(await buildBackup(serverDb));

    const calls = mockFetch([
      { status: 200, body: { blob: serverBlob, updatedAt: 111 } },
      { status: 200, body: { updatedAt: 222 } },
    ]);

    const result = await syncNow(db, auth);
    expect(result).toMatchObject({ ok: true, detail: "synced" });
    // Server attempt landed locally…
    expect((await db.allAttempts()).map((a) => a.questionId).sort()).toEqual([
      "m1/q-001",
      "m1/q-002",
    ]);
    // …and the PUT carried both attempts with the server's base version.
    const putBody = JSON.parse(String(calls[1]!.init!.body)) as {
      blob: string;
      baseUpdatedAt: number;
    };
    expect(putBody.baseUpdatedAt).toBe(111);
    expect(putBody.blob).toContain("m1/q-001");
    expect(putBody.blob).toContain("m1/q-002");
    expect(await db.getMeta("lastSyncAt")).toBeDefined();
  });

  it("skips the PUT when local stores already match the server's", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt("m1/q-001", "2026-07-19T10:00:00.000Z"));
    const blob = JSON.stringify(await buildBackup(db));

    const calls = mockFetch([{ status: 200, body: { blob, updatedAt: 111 } }]);
    const result = await syncNow(db, auth);
    expect(result).toMatchObject({ ok: true, detail: "up to date" });
    expect(calls).toHaveLength(1); // GET only, no PUT
  });

  it("on 409, pulls the newer state, merges, and retries exactly once", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt("m1/q-001", "2026-07-19T10:00:00.000Z"));

    const otherDb = await openProgressDb(freshName());
    await otherDb.recordAttempt(attempt("m1/q-003", "2026-07-19T09:00:00.000Z"));
    const otherBlob = JSON.stringify(await buildBackup(otherDb));

    const calls = mockFetch([
      { status: 200, body: { blob: null, updatedAt: 0 } }, // initial GET: empty
      { status: 409, body: { error: "conflict" } }, // our PUT loses a race
      { status: 200, body: { blob: otherBlob, updatedAt: 333 } }, // re-GET
      { status: 200, body: { updatedAt: 444 } }, // retry PUT wins
    ]);

    const result = await syncNow(db, auth);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(4);
    const retryBody = JSON.parse(String(calls[3]!.init!.body)) as {
      blob: string;
      baseUpdatedAt: number;
    };
    expect(retryBody.baseUpdatedAt).toBe(333);
    expect(retryBody.blob).toContain("m1/q-003"); // merged the racer's attempt
  });

  it("reports an expired session distinctly and clears nothing local", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt("m1/q-001", "2026-07-19T10:00:00.000Z"));
    mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
    const result = await syncNow(db, auth);
    expect(result).toMatchObject({ ok: false, signedOut: true });
    expect(await db.allAttempts()).toHaveLength(1);
  });
});
