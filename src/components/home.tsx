// Home screen: the curriculum table of contents — every module with its
// lessons, question counts, and per-lesson progress badges. Depends on:
// lib/curriculum (types), lib/route, lib/lookup, lib/progress-store.
// Depended on by: app.tsx.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum } from "../lib/curriculum";
import { lessonHref } from "../lib/route";
import { questionCountFor } from "../lib/lookup";
import type { LessonProgressRecord, ProgressDb } from "../lib/progress-store";

export function Home({
  curriculum,
  db,
}: {
  curriculum: Curriculum;
  db: ProgressDb | null;
}) {
  const [statuses, setStatuses] = useState<Map<string, LessonProgressRecord>>(new Map());
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    db.lessonStatuses()
      .then(setStatuses)
      .catch((e: unknown) => setStatusError(e instanceof Error ? e.message : String(e)));
  }, [db]);

  return (
    <div>
      {statusError && (
        <p class="warn-banner">Couldn't read progress records: {statusError}</p>
      )}
      {curriculum.modules.map((module) => (
        <section class="module-card" key={module.id}>
          <h2>{module.title}</h2>
          <ul class="lesson-list">
            {module.lessons.map((lesson) => {
              const questions = questionCountFor(module, lesson.id);
              const status = statuses.get(lesson.id)?.status;
              return (
                <li key={lesson.id}>
                  <a href={lessonHref(lesson.id)}>{lesson.title}</a>
                  <span class="lesson-meta">
                    {status === "done" && <span class="badge-done">done ✓ </span>}
                    {status === "in-progress" && (
                      <span class="badge-progress">started · </span>
                    )}
                    {questions > 0 ? `${questions} questions` : "no questions yet"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
