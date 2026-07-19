// Quiz flow: one question at a time — answer, immediate feedback with the
// explanation, then a score summary. Serves both per-lesson quizzes and the
// spaced-review deck (which spans lessons), so context arrives as props.
// Depends on: lib/curriculum (types), lib/quiz (grading), lib/progress-store.
// Depended on by: app.tsx, components/review.tsx.
//
// Persistence contract (docs/DATA_MODEL.md): every answer is written to the
// attempts store AND folded into its SRS schedule THE MOMENT it is graded —
// killing the app mid-quiz loses at most the question currently on screen.
// If a write fails, the quiz keeps working and the failure is shown, never
// swallowed.

import { useEffect, useState } from "preact/hooks";
import type { Question } from "../lib/curriculum";
import { gradeResponse, type QuizResponse } from "../lib/quiz";
import type { ProgressDb } from "../lib/progress-store";

interface QuizProps {
  /** Context line above the question counter (module title, or "Spaced review"). */
  title: string;
  backHref: string;
  backLabel: string;
  questions: Question[];
  db: ProgressDb | null;
  /** Lesson quizzes pass their lesson id: completing the run marks it done. */
  markDoneLessonId?: string;
}

interface AnsweredQuestion {
  question: Question;
  response: QuizResponse;
  correct: boolean;
}

export function Quiz({
  title,
  backHref,
  backLabel,
  questions,
  db,
  markDoneLessonId,
}: QuizProps) {
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  // "answering" → inputs live; "feedback" → result + explanation shown.
  const [phase, setPhase] = useState<"answering" | "feedback">("answering");
  // One id per quiz run, so the dashboard can group a run's attempts together.
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = questions[answered.length];

  const submit = (response: QuizResponse) => {
    if (!current) return;
    const correct = gradeResponse(current, response);
    setAnswered([...answered, { question: current, response, correct }]);
    setPhase("feedback");

    if (db) {
      const now = new Date();
      const givenAnswer =
        response.type === "mcq"
          ? (current.type === "mcq" && current.options[response.choice]) ||
            `option ${response.choice}`
          : response.text;
      const writes = [
        db.recordAttempt({
          questionId: current.id,
          at: now.toISOString(),
          correct,
          givenAnswer,
          sessionId,
        }),
        db.updateSrsOnAnswer(current.id, correct, now),
      ];
      if (answered.length === 0 && markDoneLessonId) {
        writes.push(db.setLessonStatus(markDoneLessonId, "in-progress"));
      }
      Promise.all(writes).catch((e: unknown) =>
        setSaveError(e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const restart = () => {
    setAnswered([]);
    setPhase("answering");
    setSessionId(crypto.randomUUID());
  };

  if (questions.length === 0) {
    return (
      <div>
        <p>There are no questions here yet.</p>
        <p>
          <a href={backHref}>Back to {backLabel}.</a>
        </p>
      </div>
    );
  }

  const finished = phase !== "feedback" && answered.length === questions.length;
  if (finished) {
    return (
      <Summary
        backHref={backHref}
        backLabel={backLabel}
        answered={answered}
        onRestart={restart}
        db={db}
        saveError={saveError}
        markDoneLessonId={markDoneLessonId}
      />
    );
  }

  const shown = phase === "feedback" ? answered[answered.length - 1]! : null;
  const question = shown ? shown.question : current!;
  const number = shown ? answered.length : answered.length + 1;

  return (
    <div>
      <nav class="crumbs">
        <a href={backHref}>← {backLabel}</a>
      </nav>
      <p class="lesson-module">{title}</p>
      <h2>
        Question {number} of {questions.length}
      </h2>
      <p class="quiz-prompt">{question.prompt}</p>

      {phase === "answering" ? (
        <QuestionInput question={question} onSubmit={submit} />
      ) : (
        <Feedback
          shown={shown!}
          isLast={answered.length === questions.length}
          onNext={() => setPhase("answering")}
        />
      )}
    </div>
  );
}

/* ---------------- answering ---------------- */

function QuestionInput({
  question,
  onSubmit,
}: {
  question: Question;
  onSubmit: (r: QuizResponse) => void;
}) {
  if (question.type === "mcq") {
    return (
      <div class="quiz-options">
        {question.options.map((option, i) => (
          <button
            key={option}
            class="quiz-option"
            onClick={() => onSubmit({ type: "mcq", choice: i })}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }
  return <ShortAnswerInput onSubmit={onSubmit} />;
}

function ShortAnswerInput({ onSubmit }: { onSubmit: (r: QuizResponse) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    // Empty submissions are almost always accidental Enter presses — ignore
    // them rather than grading an empty string as a wrong answer.
    if (text.trim() !== "") onSubmit({ type: "short", text });
  };
  return (
    <div class="quiz-short">
      <input
        type="text"
        value={text}
        placeholder="Type your answer"
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button class="btn" onClick={submit}>
        Submit
      </button>
    </div>
  );
}

/* ---------------- feedback ---------------- */

function Feedback({
  shown,
  isLast,
  onNext,
}: {
  shown: AnsweredQuestion;
  isLast: boolean;
  onNext: () => void;
}) {
  const { question, response, correct } = shown;
  const given =
    response.type === "mcq"
      ? question.type === "mcq" && question.options[response.choice]
      : response.text;
  return (
    <div>
      <p class={correct ? "quiz-result correct" : "quiz-result incorrect"}>
        {correct ? "Correct" : "Incorrect"}
      </p>
      {!correct && (
        <p class="quiz-given">
          Your answer: {given}
          {question.type === "mcq" && (
            <>
              {" — "}correct answer: <strong>{question.options[question.answer]}</strong>
            </>
          )}
          {question.type === "short" && (
            <>
              {" — "}accepted: <strong>{question.accept[0]}</strong>
            </>
          )}
        </p>
      )}
      <p class="quiz-explanation">{question.explanation}</p>
      <button class="btn" onClick={onNext}>
        {isLast ? "See results" : "Next question"}
      </button>
    </div>
  );
}

/* ---------------- summary ---------------- */

function Summary({
  backHref,
  backLabel,
  answered,
  onRestart,
  db,
  saveError,
  markDoneLessonId,
}: {
  backHref: string;
  backLabel: string;
  answered: AnsweredQuestion[];
  onRestart: () => void;
  db: ProgressDb | null;
  saveError: string | null;
  markDoneLessonId?: string;
}) {
  const correctCount = answered.filter((a) => a.correct).length;
  const [statusError, setStatusError] = useState<string | null>(null);

  // Completing a lesson quiz marks the lesson done — once, on first render
  // of the summary, not on every re-render.
  useEffect(() => {
    if (db && !saveError && markDoneLessonId) {
      db.setLessonStatus(markDoneLessonId, "done").catch((e: unknown) =>
        setStatusError(e instanceof Error ? e.message : String(e)),
      );
    }
  }, []);
  return (
    <div>
      <nav class="crumbs">
        <a href={backHref}>← {backLabel}</a>
      </nav>
      <h2>
        {correctCount} of {answered.length} correct
      </h2>
      <ul class="quiz-review">
        {answered.map(({ question, correct }) => (
          <li key={question.id} class={correct ? "correct" : "incorrect"}>
            <span class="quiz-review-mark">{correct ? "✓" : "✗"}</span>
            {question.prompt}
          </li>
        ))}
      </ul>
      {db && !saveError ? (
        <p class="quiz-note">
          All {answered.length} answers were recorded on this device
          {statusError ? ` (but marking the lesson done failed: ${statusError})` : ""}.
          Missed questions resurface on the review schedule.
        </p>
      ) : (
        <p class="quiz-note quiz-note-warn">
          These results were NOT saved
          {saveError
            ? ` — saving failed: ${saveError}`
            : " — progress storage is unavailable in this browser"}
          .
        </p>
      )}
      <div class="quiz-actions">
        <button class="btn" onClick={onRestart}>
          Retry quiz
        </button>
        <a href={backHref}>Back to {backLabel}</a>
      </div>
    </div>
  );
}
