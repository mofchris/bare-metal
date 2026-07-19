// Quiz grading: maps a student response onto a question and says if it's
// correct. Depends on: curriculum.ts (types), short-answer.ts.
// Depended on by: components/quiz.tsx.
//
// Kept separate from the UI so grading is testable without a DOM and
// reusable by the spaced-repetition engine in Stage B.

import type { Question } from "./curriculum";
import { matchesAccepted } from "./short-answer";

export type QuizResponse =
  { type: "mcq"; choice: number } | { type: "short"; text: string };

/** True if the response answers the question correctly. */
export function gradeResponse(question: Question, response: QuizResponse): boolean {
  if (question.type === "mcq" && response.type === "mcq") {
    return response.choice === question.answer;
  }
  if (question.type === "short" && response.type === "short") {
    return matchesAccepted(response.text, question.accept);
  }
  // A type mismatch is a programming error in the caller, not a wrong answer —
  // grading it as incorrect would silently corrupt future SRS history.
  throw new Error(
    `gradeResponse: response type "${response.type}" does not match ` +
      `question type "${question.type}" (question ${question.id})`,
  );
}
