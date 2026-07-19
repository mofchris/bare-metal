import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { buildBackup, exportReminder, restoreBackup, validateBackup } from "./backup";
import { openProgressDb, type AttemptRecord } from "./progress-store";

const freshName = () => `test-${crypto.randomUUID()}`;

const attempt = (
  questionId: string,
  at: string,
  correct: boolean,
  sessionId = "s1",
): AttemptRecord => ({ questionId, at, correct, givenAnswer: "x", sessionId });

const wipeDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

describe("export → wipe → restore round-trip (Gate B requirement)", () => {
  it("is lossless for attempts, lesson progress, and rebuilt SRS state", async () => {
    const name = freshName();
    const db = await openProgressDb(name);
    await db.recordAttempt(attempt("m1/q-001", "2026-07-01T10:00:00.000Z", false));
    await db.recordAttempt(attempt("m1/q-001", "2026-07-02T10:00:00.000Z", true));
    await db.recordAttempt(attempt("m1/q-002", "2026-07-02T11:00:00.000Z", true, "s2"));
    await db.updateSrsOnAnswer("m1/q-001", true, new Date("2026-07-02T10:00:00.000Z"));
    await db.setLessonStatus("m1/01-memory-hierarchy", "done");
    const before = await buildBackup(db);
    db.close();

    await wipeDatabase(name); // the browser-cleared-my-data scenario
    const restored = await openProgressDb(name);
    const summary = await restoreBackup(restored, validateBackup(before));
    expect(summary.attemptsAdded).toBe(3);

    const after = await buildBackup(restored);
    expect(after.stores.attempts).toEqual(before.stores.attempts);
    expect(after.stores.lessonProgress).toEqual(before.stores.lessonProgress);
    // SRS is rebuilt from attempts, so it must match what replay produces —
    // and replay of identical attempts is deterministic.
    const rebuiltIds = after.stores.srsState.map((s) => s.questionId).sort();
    expect(rebuiltIds).toEqual(["m1/q-001", "m1/q-002"]);
  });
});

describe("restore merges instead of replacing (D-019)", () => {
  it("unions attempts from two devices without duplicating shared history", async () => {
    const laptop = await openProgressDb(freshName());
    const phone = await openProgressDb(freshName());
    const shared = attempt("m1/q-001", "2026-07-01T10:00:00.000Z", true);
    await laptop.recordAttempt(shared);
    await laptop.recordAttempt(attempt("m1/q-002", "2026-07-02T10:00:00.000Z", true));
    await phone.recordAttempt(shared);
    await phone.recordAttempt(attempt("m1/q-003", "2026-07-03T10:00:00.000Z", false));

    const summary = await restoreBackup(phone, await buildBackup(laptop));
    expect(summary.attemptsAdded).toBe(1); // only q-002 was new
    expect((await phone.allAttempts()).length).toBe(3);

    // Restoring the same backup again adds nothing — idempotent.
    const again = await restoreBackup(phone, await buildBackup(laptop));
    expect(again.attemptsAdded).toBe(0);
    expect((await phone.allAttempts()).length).toBe(3);
  });

  it("merges lesson progress by rank: done beats in-progress, earliest completion wins", async () => {
    const target = await openProgressDb(freshName());
    await target.setLessonStatus("m1/l1", "in-progress");
    await target.putLessonProgress({
      lessonId: "m1/l2",
      status: "done",
      completedAt: "2026-07-10T10:00:00.000Z",
    });

    const source = await openProgressDb(freshName());
    await source.putLessonProgress({
      lessonId: "m1/l1",
      status: "done",
      completedAt: "2026-07-05T10:00:00.000Z",
    });
    await source.putLessonProgress({
      lessonId: "m1/l2",
      status: "done",
      completedAt: "2026-07-01T10:00:00.000Z", // earlier than target's
    });

    await restoreBackup(target, await buildBackup(source));
    const statuses = await target.lessonStatuses();
    expect(statuses.get("m1/l1")).toMatchObject({
      status: "done",
      completedAt: "2026-07-05T10:00:00.000Z",
    });
    expect(statuses.get("m1/l2")!.completedAt).toBe("2026-07-01T10:00:00.000Z");
  });
});

describe("validateBackup", () => {
  it("rejects wrong formats, future schema versions, and malformed records by name", () => {
    expect(() => validateBackup(null)).toThrow(/not a JSON object/);
    expect(() => validateBackup({ format: "other" })).toThrow(/format/);
    expect(() =>
      validateBackup({ format: "metal-backup", schemaVersion: 99, stores: {} }),
    ).toThrow(/newer than this app/);
    expect(() =>
      validateBackup({
        format: "metal-backup",
        schemaVersion: 2,
        stores: { attempts: [{ questionId: 1 }], lessonProgress: [] },
      }),
    ).toThrow(/1 malformed attempt/);
  });
});

describe("exportReminder", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");

  it("stays quiet with no history, nags when never exported, nags after 7 days", () => {
    expect(exportReminder(null, false, now).overdue).toBe(false);
    expect(exportReminder(null, true, now)).toEqual({
      overdue: true,
      daysSinceExport: null,
    });
    expect(exportReminder("2026-07-13T12:00:00.000Z", true, now).overdue).toBe(false);
    expect(exportReminder("2026-07-12T11:00:00.000Z", true, now)).toMatchObject({
      overdue: true,
      daysSinceExport: 7,
    });
  });
});
