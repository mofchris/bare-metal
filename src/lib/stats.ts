// Dashboard derivations: pure functions from the append-only attempts store
// (+ curriculum) to everything the dashboard shows. Depends on: curriculum.ts
// (types), progress-store.ts (AttemptRecord type). Depended on by:
// components/dashboard.tsx.
//
// Everything here is DERIVED — no store writes, no caching. The Gate B
// performance requirement (instant with 1000+ records) is met by doing one
// linear pass per derivation; a test pins that with 5000 records.

import type { Curriculum } from "./curriculum";
import type { AttemptRecord } from "./progress-store";

export interface LessonMastery {
  lessonId: string;
  lessonTitle: string;
  /** Questions in this lesson whose LATEST attempt was correct. */
  mastered: number;
  /** Questions in this lesson attempted at least once. */
  attempted: number;
  totalQuestions: number;
  /** mastered/attempted, or null when nothing was attempted yet. */
  masteryPct: number | null;
}

export interface RunSummary {
  sessionId: string;
  /** Timestamp of the run's first attempt. */
  startedAt: string;
  correct: number;
  total: number;
}

export interface StreakInfo {
  /** Local date keys (YYYY-MM-DD) with at least one attempt. */
  activeDays: Set<string>;
  /** Consecutive study days ending today (or yesterday, if today is untouched). */
  currentStreak: number;
}

/** Local-timezone YYYY-MM-DD — streaks follow the student's wall clock. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Mastery per lesson: a question counts as mastered iff its most recent
 * attempt was correct. "Currently known" — not historical accuracy, which
 * punishes early mistakes forever.
 */
export function masteryByLesson(
  curriculum: Curriculum,
  attempts: AttemptRecord[],
): LessonMastery[] {
  const latest = new Map<string, AttemptRecord>();
  for (const attempt of attempts) {
    const prev = latest.get(attempt.questionId);
    if (!prev || attempt.at > prev.at) latest.set(attempt.questionId, attempt);
  }

  const out: LessonMastery[] = [];
  for (const module of curriculum.modules) {
    for (const lesson of module.lessons) {
      let mastered = 0;
      let attempted = 0;
      let total = 0;
      for (const question of module.questions) {
        if (question.lesson !== lesson.id) continue;
        total += 1;
        const last = latest.get(question.id);
        if (last) {
          attempted += 1;
          if (last.correct) mastered += 1;
        }
      }
      out.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        mastered,
        attempted,
        totalQuestions: total,
        masteryPct: attempted > 0 ? Math.round((mastered / attempted) * 100) : null,
      });
    }
  }
  return out;
}

/** Attempted lessons, weakest mastery first (ties: fewer attempts first). */
export function weakestLessons(mastery: LessonMastery[], limit: number): LessonMastery[] {
  return mastery
    .filter((m) => m.attempted > 0)
    .sort(
      (a, b) => (a.masteryPct ?? 0) - (b.masteryPct ?? 0) || a.attempted - b.attempted,
    )
    .slice(0, limit);
}

/** Quiz runs (grouped by sessionId), oldest→newest, capped to the last `limit`. */
export function runHistory(attempts: AttemptRecord[], limit: number): RunSummary[] {
  const runs = new Map<string, RunSummary>();
  for (const attempt of attempts) {
    const run = runs.get(attempt.sessionId);
    if (!run) {
      runs.set(attempt.sessionId, {
        sessionId: attempt.sessionId,
        startedAt: attempt.at,
        correct: attempt.correct ? 1 : 0,
        total: 1,
      });
    } else {
      run.total += 1;
      if (attempt.correct) run.correct += 1;
      if (attempt.at < run.startedAt) run.startedAt = attempt.at;
    }
  }
  return [...runs.values()]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-limit);
}

/**
 * Study streak from attempt timestamps. Today not (yet) studying doesn't
 * break the streak until the day is over — the streak counts from today if
 * active, else from yesterday.
 */
export function streakInfo(attempts: AttemptRecord[], now: Date): StreakInfo {
  const activeDays = new Set<string>();
  for (const attempt of attempts) activeDays.add(localDateKey(new Date(attempt.at)));

  const DAY_MS = 24 * 60 * 60 * 1000;
  let currentStreak = 0;
  let cursor = now.getTime();
  if (!activeDays.has(localDateKey(now))) cursor -= DAY_MS; // grace for today
  while (activeDays.has(localDateKey(new Date(cursor)))) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }
  return { activeDays, currentStreak };
}
