// Study-time tracking + the 30-minute streak rule (D-024).
// Depends on: stats.ts (localDateKey). Depended on by: app.tsx (the ticker),
// components/panels.tsx (calendar), home/dashboard.
//
// Time is recorded as one row per (day, installId): seconds only ever grow,
// which makes cross-device merge trivially idempotent (max per row, sum per
// day). Tracking is a 15-second heartbeat while a study screen is visible —
// deliberately approximate (±15 s per sitting) and honest about it.

import { localDateKey } from "./stats";

export const DAILY_GOAL_SECONDS = 30 * 60;
/** Heartbeat period for the app's study ticker (app.tsx). */
export const TICK_SECONDS = 15;

export interface StudyTimeRecord {
  /** `${day}|${installId}` — the store key. */
  id: string;
  day: string; // local YYYY-MM-DD
  installId: string;
  seconds: number;
}

export function studyTimeId(day: string, installId: string): string {
  return `${day}|${installId}`;
}

/** Total tracked seconds per day (summed across devices). */
export function secondsByDay(records: StudyTimeRecord[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of records) out.set(r.day, (out.get(r.day) ?? 0) + r.seconds);
  return out;
}

/**
 * Does a day count toward the streak? ≥30 tracked minutes — with one
 * grandfather clause: days from before time tracking existed have attempts
 * but no time rows at all, and completing quizzes was the bar then.
 */
export function dayCounted(
  day: string,
  seconds: Map<string, number>,
  attemptDays: Set<string>,
): boolean {
  const tracked = seconds.get(day);
  if (tracked !== undefined) return tracked >= DAILY_GOAL_SECONDS;
  return attemptDays.has(day);
}

export interface StudyStreak {
  /** Consecutive counted days ending today (or yesterday — today doesn't
      break the streak until it's over). */
  current: number;
  todaySeconds: number;
  countedDays: Set<string>;
}

export function studyStreak(
  records: StudyTimeRecord[],
  attemptDays: Set<string>,
  now: Date,
): StudyStreak {
  const seconds = secondsByDay(records);
  const countedDays = new Set<string>();
  for (const day of new Set([...seconds.keys(), ...attemptDays])) {
    if (dayCounted(day, seconds, attemptDays)) countedDays.add(day);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  let current = 0;
  let cursor = now.getTime();
  if (!countedDays.has(localDateKey(now))) cursor -= DAY_MS; // grace for today
  while (countedDays.has(localDateKey(new Date(cursor)))) {
    current += 1;
    cursor -= DAY_MS;
  }
  return { current, todaySeconds: seconds.get(localDateKey(now)) ?? 0, countedDays };
}
