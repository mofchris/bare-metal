// Lesson screen: objectives, the lesson body, sources, and next-lesson nav.
// Depends on: lib/curriculum (types), lib/route, lib/lookup (LessonLocation),
// components/reading-progress. Depended on by: app.tsx.

import { questionCountFor, type LessonLocation } from "../lib/lookup";
import { lessonHref, quizHref } from "../lib/route";
import { ReadingBookmark } from "./reading-progress";
import type { ProgressDb } from "../lib/progress-store";

export function LessonView({
  location,
  nextUnlocked,
  db,
}: {
  location: LessonLocation;
  /** False when the next lesson still needs this lesson's quiz (D-023). */
  nextUnlocked: boolean;
  db: ProgressDb | null;
}) {
  const { module, lesson, next } = location;
  const questionCount = questionCountFor(module, lesson.id);
  return (
    <article>
      {/* Keyed by lesson id so moving between lessons re-reads that lesson's
          own saved position (D-035). The bar itself lives in the app shell,
          because it belongs on every screen, not only on lessons. */}
      <ReadingBookmark key={location.lesson.id} lessonId={location.lesson.id} db={db} />
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
        {next &&
          (nextUnlocked ? (
            <p class="next-lesson">
              Next: <a href={lessonHref(next.id)}>{next.title}</a>
            </p>
          ) : (
            // Offering a link here used to walk the reader straight past the
            // quiz (D-023). Name what's next, but make the quiz the only door.
            <p class="next-lesson next-locked">
              Next: <span class="locked-title">{next.title}</span> — locked until you pass
              this lesson's quiz.
            </p>
          ))}
      </footer>
    </article>
  );
}
