// Review screen: the spaced-repetition deck — every question currently due,
// across all modules, run through the shared Quiz flow. Depends on:
// lib/curriculum (types), lib/lookup, lib/srs, lib/progress-store,
// components/quiz. Depended on by: app.tsx.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum, Question } from "../lib/curriculum";
import { questionById } from "../lib/lookup";
import { dueQuestionIds, nextDueAt } from "../lib/srs";
import type { ProgressDb } from "../lib/progress-store";
import { Quiz } from "./quiz";

type DeckState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; questions: Question[]; nextDue: string | null };

export function Review({
  curriculum,
  db,
}: {
  curriculum: Curriculum;
  db: ProgressDb | null;
}) {
  const [deck, setDeck] = useState<DeckState>({ status: "loading" });

  useEffect(() => {
    if (!db) return;
    db.allSrsStates()
      .then((states) => {
        const now = new Date();
        const lookup = questionById(curriculum);
        // A due id with no matching question means content was renamed or
        // removed after it was studied — skip it rather than crash the deck,
        // but keep it visible in the console (content ids are meant to be
        // stable forever; this should never happen).
        const questions: Question[] = [];
        for (const id of dueQuestionIds(states, now)) {
          const question = lookup.get(id);
          if (question) questions.push(question);
          else console.error(`Metal: due question "${id}" no longer exists in content`);
        }
        setDeck({ status: "ready", questions, nextDue: nextDueAt(states, now) });
      })
      .catch((e: unknown) =>
        setDeck({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      );
  }, [db]);

  if (!db) {
    return (
      <p class="quiz-note-warn">
        Review needs progress storage, which is unavailable in this browser.
      </p>
    );
  }
  if (deck.status === "loading") return <p class="status">Loading review deck…</p>;
  if (deck.status === "error") {
    return (
      <div class="error-block">
        <h2>Couldn't load the review deck</h2>
        <p>{deck.message}</p>
      </div>
    );
  }
  if (deck.questions.length === 0) {
    return (
      <div>
        <nav class="crumbs">
          <a href="#/">← All modules</a>
        </nav>
        <h2>Nothing due for review</h2>
        <p>
          {deck.nextDue
            ? `Next review: ${new Date(deck.nextDue).toLocaleString()}.`
            : "Answer some quiz questions and they'll start appearing here on a spaced schedule."}
        </p>
      </div>
    );
  }
  return (
    <Quiz
      title="Spaced review"
      backHref="#/"
      backLabel="All modules"
      questions={deck.questions}
      db={db}
    />
  );
}
