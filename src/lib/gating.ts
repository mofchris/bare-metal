// Progression gating (D-023): lessons unlock in order within a module (75%
// on the previous lesson's quiz), the module exam unlocks when every lesson
// is passed, and a module unlocks when all its prereq modules' exams are
// passed. Depends on: curriculum.ts, progress-store.ts (types only).
// Depended on by: home.tsx, app.tsx (route guards), quiz summary copy.

import type { Module } from "./curriculum";
import type { ExamResultRecord, LessonProgressRecord } from "./progress-store";

export const PASS_MARK = 75;

/** A lesson counts as passed at "done" with ≥75%. Records from before
    gating existed carry no score; completing was the bar then, so they pass. */
export function lessonPassed(record: LessonProgressRecord | undefined): boolean {
  if (!record || record.status !== "done") return false;
  return record.bestScorePct === undefined || record.bestScorePct >= PASS_MARK;
}

/** First lesson of a module is open; each later lesson needs the previous one passed. */
export function lessonUnlocked(
  module: Module,
  lessonId: string,
  statuses: Map<string, LessonProgressRecord>,
): boolean {
  const index = module.lessons.findIndex((l) => l.id === lessonId);
  if (index <= 0) return true;
  return lessonPassed(statuses.get(module.lessons[index - 1]!.id));
}

/** The exam opens once every lesson in the module is passed. */
export function examUnlocked(
  module: Module,
  statuses: Map<string, LessonProgressRecord>,
): boolean {
  return module.lessons.every((l) => lessonPassed(statuses.get(l.id)));
}

/** A module opens when every prereq module's exam is passed (M1 has none). */
export function moduleUnlocked(
  module: Module,
  exams: Map<string, ExamResultRecord>,
): boolean {
  return module.prereqs.every((p) => exams.get(p)?.passed === true);
}

/** Count of passed lessons — drives the per-module progress bar. */
export function passedLessonCount(
  module: Module,
  statuses: Map<string, LessonProgressRecord>,
): number {
  return module.lessons.filter((l) => lessonPassed(statuses.get(l.id))).length;
}
