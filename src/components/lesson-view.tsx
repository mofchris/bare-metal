// Lesson screen: objectives, the lesson body, sources, and next-lesson nav.
// Depends on: lib/curriculum (types), lib/route, lib/lookup (LessonLocation).
// Depended on by: app.tsx.

import { questionCountFor, type LessonLocation } from "../lib/lookup";
import { lessonHref, quizHref } from "../lib/route";

export function LessonView({ location }: { location: LessonLocation }) {
  const { module, lesson, next } = location;
  const questionCount = questionCountFor(module, lesson.id);
  return (
    <article>
      <nav class="crumbs">
        <a href="#/">← All modules</a>
      </nav>
      <p class="lesson-module">{module.title}</p>
      <h2>{lesson.title}</h2>

      <div class="objectives">
        <h3>After this lesson you can:</h3>
        <ul>
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </div>

      {/* Safe by construction: this HTML was rendered at build time by the
          content compiler from repo-reviewed Markdown — it is our own
          content, not user input (trust model documented in D-014). */}
      <div class="lesson-body" dangerouslySetInnerHTML={{ __html: lesson.html }} />

      {questionCount > 0 && (
        <p class="quiz-cta">
          <a class="btn" href={quizHref(lesson.id)}>
            Take the quiz ({questionCount} questions)
          </a>
        </p>
      )}

      <footer class="lesson-footer">
        <div class="sources">
          <h3>Sources</h3>
          <ul>
            {lesson.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
        {next && (
          <p class="next-lesson">
            Next: <a href={lessonHref(next.id)}>{next.title}</a>
          </p>
        )}
      </footer>
    </article>
  );
}
