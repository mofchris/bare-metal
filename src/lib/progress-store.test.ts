// fake-indexeddb/auto installs an in-memory IndexedDB implementation on
// globalThis so persistence is testable in Node (D-017).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openProgressDb, type AttemptRecord } from "./progress-store";

// Each test opens a uniquely named database for isolation; fake-indexeddb
// keeps databases alive in memory for the process, which is what lets the
// reopen test verify durability across close().
const freshName = () => `test-${crypto.randomUUID()}`;

const attempt = (overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  questionId: "m1/q-001",
  at: "2026-07-19T12:00:00.000Z",
  correct: true,
  givenAnswer: "About 100×",
  sessionId: "session-1",
  ...overrides,
});

describe("progress store", () => {
  it("records attempts and reads them back in insertion order", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt());
    await db.recordAttempt(attempt({ questionId: "m1/q-002", correct: false }));
    const all = await db.allAttempts();
    expect(all).toHaveLength(2);
    expect(all[0]!.questionId).toBe("m1/q-001");
    expect(all[1]!.correct).toBe(false);
  });

  it("attempt history survives closing and reopening the database", async () => {
    const name = freshName();
    const first = await openProgressDb(name);
    await first.recordAttempt(attempt());
    first.close();

    const reopened = await openProgressDb(name);
    const all = await reopened.allAttempts();
    expect(all).toHaveLength(1);
    expect(all[0]!.givenAnswer).toBe("About 100×");
  });

  it("filters attempt history by question id", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt());
    await db.recordAttempt(attempt({ questionId: "m1/q-002" }));
    await db.recordAttempt(attempt({ correct: false }));
    const forFirst = await db.attemptsForQuestion("m1/q-001");
    expect(forFirst).toHaveLength(2);
    expect(forFirst.every((a) => a.questionId === "m1/q-001")).toBe(true);
  });

  it("upserts lesson status and stamps completedAt only when done", async () => {
    const db = await openProgressDb(freshName());
    await db.setLessonStatus("m1/01-memory-hierarchy", "in-progress");
    let statuses = await db.lessonStatuses();
    expect(statuses.get("m1/01-memory-hierarchy")!.status).toBe("in-progress");
    expect(statuses.get("m1/01-memory-hierarchy")!.completedAt).toBeUndefined();

    await db.setLessonStatus("m1/01-memory-hierarchy", "done");
    statuses = await db.lessonStatuses();
    expect(statuses.get("m1/01-memory-hierarchy")!.status).toBe("done");
    expect(statuses.get("m1/01-memory-hierarchy")!.completedAt).toMatch(/^\d{4}-/);
  });

  it("treats unvisited lessons as absent rather than storing not-started rows", async () => {
    const db = await openProgressDb(freshName());
    const statuses = await db.lessonStatuses();
    expect(statuses.size).toBe(0);
  });

  it("folds graded answers into per-question SRS schedules", async () => {
    const db = await openProgressDb(freshName());
    const now = new Date("2026-07-19T12:00:00.000Z");
    await db.updateSrsOnAnswer("m1/q-001", true, now);
    await db.updateSrsOnAnswer("m1/q-002", false, now);
    const states = await db.allSrsStates();
    expect(states).toHaveLength(2);
    const byId = new Map(states.map((s) => [s.questionId, s]));
    expect(byId.get("m1/q-001")!.reps).toBe(1);
    expect(byId.get("m1/q-002")!.lapses).toBe(1);
    // both resurface exactly one day later (first rung / relearn rung)
    expect(byId.get("m1/q-001")!.dueAt).toBe("2026-07-20T12:00:00.000Z");
    expect(byId.get("m1/q-002")!.dueAt).toBe("2026-07-20T12:00:00.000Z");
  });

  it("rebuilds the full SRS store from attempt history alone (derived state)", async () => {
    const db = await openProgressDb(freshName());
    await db.recordAttempt(attempt({ at: "2026-07-01T10:00:00.000Z", correct: true }));
    await db.recordAttempt(attempt({ at: "2026-07-03T10:00:00.000Z", correct: true }));
    await db.recordAttempt(
      attempt({ questionId: "m1/q-002", at: "2026-07-02T10:00:00.000Z", correct: false }),
    );
    await db.rebuildSrsFromAttempts();
    const byId = new Map((await db.allSrsStates()).map((s) => [s.questionId, s]));
    // q-001: two successes → second rung, 6-day interval from the later attempt
    expect(byId.get("m1/q-001")!.intervalDays).toBe(6);
    expect(byId.get("m1/q-001")!.dueAt).toBe("2026-07-09T10:00:00.000Z");
    // q-002: one miss → relearn rung
    expect(byId.get("m1/q-002")!.lapses).toBe(1);
    expect(byId.get("m1/q-002")!.intervalDays).toBe(1);
  });
});
