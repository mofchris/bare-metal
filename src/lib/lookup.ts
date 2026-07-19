// Curriculum lookups shared by screens.
// Depends on: curriculum.ts (types). Depended on by: app.tsx, lesson-view.tsx.

import type { Curriculum, Lesson, Module, Question } from "./curriculum";

export interface LessonLocation {
  module: Module;
  lesson: Lesson;
  /** The lesson after this one in module order, if any — drives "next" nav. */
  next: Lesson | null;
}

/** Find a lesson by id across all modules; null if it doesn't exist. */
export function findLesson(
  curriculum: Curriculum,
  lessonId: string,
): LessonLocation | null {
  for (const module of curriculum.modules) {
    const index = module.lessons.findIndex((l) => l.id === lessonId);
    if (index !== -1) {
      return {
        module,
        lesson: module.lessons[index]!,
        next: module.lessons[index + 1] ?? null,
      };
    }
  }
  return null;
}

/** All questions attached to a specific lesson, in question-bank order. */
export function questionsFor(module: Module, lessonId: string): Question[] {
  return module.questions.filter((q) => q.lesson === lessonId);
}

/** Count questions attached to a specific lesson. */
export function questionCountFor(module: Module, lessonId: string): number {
  return questionsFor(module, lessonId).length;
}
