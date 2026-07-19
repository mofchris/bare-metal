// Home screen: the curriculum table of contents — every module with its
// lessons and question counts. Depends on: lib/curriculum (types),
// lib/route, lib/lookup. Depended on by: app.tsx.

import type { Curriculum } from "../lib/curriculum";
import { lessonHref } from "../lib/route";
import { questionCountFor } from "../lib/lookup";

export function Home({ curriculum }: { curriculum: Curriculum }) {
  return (
    <div>
      {curriculum.modules.map((module) => (
        <section class="module-card" key={module.id}>
          <h2>{module.title}</h2>
          <ul class="lesson-list">
            {module.lessons.map((lesson) => {
              const questions = questionCountFor(module, lesson.id);
              return (
                <li key={lesson.id}>
                  <a href={lessonHref(lesson.id)}>{lesson.title}</a>
                  <span class="lesson-meta">
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
