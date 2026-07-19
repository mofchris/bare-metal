// Quiz screen: one question at a time — answer, immediate feedback with the
// explanation, then a score summary. Depends on: lib/curriculum (types),
// lib/quiz (grading), lib/route. Depended on by: app.tsx.
//
// Results live only in component state for now: persistence (IndexedDB,
// D-007) is the next Stage A piece, and the summary says so out loud rather
// than letting anyone believe their history is being kept.

import { useState } from "preact/hooks";
import type { Lesson, Module, Question } from "../lib/curriculum";
import { gradeResponse, type QuizResponse } from "../lib/quiz";
import { lessonHref } from "../lib/route";

interface QuizProps {
  module: Module;
  lesson: Lesson;
  questions: Question[];
}

interface AnsweredQuestion {
  question: Question;
  response: QuizResponse;
  correct: boolean;
}

export function Quiz({ module, lesson, questions }: QuizProps) {
  const [answered, setAnswered] = useState<AnsweredQuestion[]>([]);
  // "answering" → inputs live; "feedback" → result + explanation shown.
  const [phase, setPhase] = useState<"answering" | "feedback">("answering");

  const current = questions[answered.length];

  const submit = (response: QuizResponse) => {
    if (!current) return;
    setAnswered([
      ...answered,
      { question: current, response, correct: gradeResponse(current, response) },
    ]);
    setPhase("feedback");
  };

  const restart = () => {
    setAnswered([]);
    setPhase("answering");
  };

  if (questions.length === 0) {
    return (
      <div>
        <p>This lesson has no questions yet.</p>
        <p>
          <a href={lessonHref(lesson.id)}>Back to the lesson.</a>
        </p>
      </div>
    );
  }

  const finished = phase !== "feedback" && answered.length === questions.length;
  if (finished) {
    return <Summary lesson={lesson} answered={answered} onRestart={restart} />;
  }

  const shown = phase === "feedback" ? answered[answered.length - 1]! : null;
  const question = shown ? shown.question : current!;
  const number = shown ? answered.length : answered.length + 1;

  return (
    <div>
      <nav class="crumbs">
        <a href={lessonHref(lesson.id)}>← {lesson.title}</a>
      </nav>
      <p class="lesson-module">{module.title}</p>
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
  lesson,
  answered,
  onRestart,
}: {
  lesson: Lesson;
  answered: AnsweredQuestion[];
  onRestart: () => void;
}) {
  const correctCount = answered.filter((a) => a.correct).length;
  return (
    <div>
      <nav class="crumbs">
        <a href={lessonHref(lesson.id)}>← {lesson.title}</a>
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
      <p class="quiz-note">
        Results aren't saved yet — progress persistence is the next piece of Stage A. For
        now this is practice only.
      </p>
      <div class="quiz-actions">
        <button class="btn" onClick={onRestart}>
          Retry quiz
        </button>
        <a href={lessonHref(lesson.id)}>Back to the lesson</a>
      </div>
    </div>
  );
}
