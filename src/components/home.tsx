// Home: the dashboard-first landing. A data-driven hero (or a start-here
// push when there's no history yet), the module map with its via rail, and a
// side rail of progress panels. Depends on: lib/curriculum, lib/route,
// lib/lookup, lib/srs, lib/stats, lib/backup, lib/progress-store,
// components/panels. Depended on by: app.tsx.
//
// Every hero state pushes ONE next action: start (no history), review (cards
// due), or continue (next unfinished lesson). The user should never have to
// decide what studying means today.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum, Lesson } from "../lib/curriculum";
import { lessonHref, quizHref } from "../lib/route";
import { questionCountFor } from "../lib/lookup";
import { dueQuestionIds, nextDueAt } from "../lib/srs";
import { exportReminder, type ReminderState } from "../lib/backup";
import { masteryByLesson, runHistory, streakInfo, weakestLessons } from "../lib/stats";
import type {
  AttemptRecord,
  LessonProgressRecord,
  ProgressDb,
} from "../lib/progress-store";
import { RunTrend, StreakCalendar, WeakestAreas } from "./panels";

interface ProgressData {
  statuses: Map<string, LessonProgressRecord>;
  attempts: AttemptRecord[];
  due: number;
  nextDue: string | null;
  reminder: ReminderState;
}

export function Home({
  curriculum,
  db,
}: {
  curriculum: Curriculum;
  db: ProgressDb | null;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    Promise.all([
      db.lessonStatuses(),
      db.allAttempts(),
      db.allSrsStates(),
      db.getMeta("lastExportAt"),
    ])
      .then(([statuses, attempts, srs, lastExportAt]) => {
        const now = new Date();
        setData({
          statuses,
          attempts,
          due: dueQuestionIds(srs, now).length,
          nextDue: nextDueAt(srs, now),
          reminder: exportReminder(lastExportAt ?? null, attempts.length > 0, now),
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [db]);

  const statuses = data?.statuses ?? new Map<string, LessonProgressRecord>();
  const lessons = curriculum.modules.flatMap((m) => m.lessons);
  const doneCount = lessons.filter((l) => statuses.get(l.id)?.status === "done").length;
  const continueLesson = lessons.find((l) => statuses.get(l.id)?.status !== "done");

  return (
    <div>
      {error && <p class="warn-banner">Couldn't read progress records: {error}</p>}
      {data?.reminder.overdue && (
        <p class="warn-banner">
          {data.reminder.daysSinceExport === null
            ? "Your progress has never been backed up on this device."
            : `Last backup was ${data.reminder.daysSinceExport} days ago.`}{" "}
          Browser storage can be wiped without warning:{" "}
          <a href="#/backup">export a backup file</a>.
        </p>
      )}

      <Hero
        curriculum={curriculum}
        data={data}
        doneCount={doneCount}
        totalLessons={lessons.length}
        continueLesson={continueLesson}
      />

      <div class="home-grid">
        <section class="home-modules rise" style={{ animationDelay: "90ms" }}>
          {curriculum.modules.map((module) => (
            <section class="module-block" key={module.id}>
              <div class="module-head">
                <h2>{module.title}</h2>
                <span class="lesson-meta">
                  {
                    module.lessons.filter((l) => statuses.get(l.id)?.status === "done")
                      .length
                  }
                  /{module.lessons.length} done
                </span>
              </div>
              <ul class="lesson-list">
                {module.lessons.map((lesson) => {
                  const questions = questionCountFor(module, lesson.id);
                  const status = statuses.get(lesson.id)?.status;
                  // The class drives the via-rail marker: done = filled
                  // copper, started = copper ring, absent = hollow.
                  return (
                    <li
                      key={lesson.id}
                      class={
                        status === "done"
                          ? "done"
                          : status === "in-progress"
                            ? "started"
                            : ""
                      }
                    >
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
        </section>

        <aside class="home-rail rise" style={{ animationDelay: "180ms" }}>
          {(!data || data.attempts.length === 0) && <HowItWorks />}
          <ActivityPanel data={data} />
          {data && <RunTrend runs={runHistory(data.attempts, 10)} />}
          {data && (
            <WeakestAreas
              weakest={weakestLessons(masteryByLesson(curriculum, data.attempts), 3)}
            />
          )}
          {data && data.attempts.length > 0 && (
            <section>
              <h3 class="dash-section">Backup</h3>
              <p class="rail-note">
                {data.reminder.daysSinceExport === null
                  ? "Never exported on this device."
                  : `Last export ${data.reminder.daysSinceExport} day${data.reminder.daysSinceExport === 1 ? "" : "s"} ago.`}{" "}
                <a href="#/backup">Export</a>
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/* The hero pushes exactly one action, chosen from the data. */
function Hero({
  curriculum,
  data,
  doneCount,
  totalLessons,
  continueLesson,
}: {
  curriculum: Curriculum;
  data: ProgressData | null;
  doneCount: number;
  totalLessons: number;
  continueLesson: Lesson | undefined;
}) {
  const questionTotal = curriculum.modules.reduce((n, m) => n + m.questions.length, 0);

  // Fresh device: sell the loop once, then push lesson 1.
  if (!data || data.attempts.length === 0) {
    const first = curriculum.modules[0]?.lessons[0];
    return (
      <section class="hero rise">
        <p class="hero-eyebrow">Machine Learning Systems · self-study</p>
        <h2 class="hero-title">Learn the metal under the models.</h2>
        <p class="hero-sub">
          {totalLessons} sourced lessons across {curriculum.modules.length} modules,{" "}
          {questionTotal} quiz questions that come back on a spaced schedule. Works
          offline, keeps score honestly.
        </p>
        {first && (
          <p class="hero-actions">
            <a class="btn btn-lg" href={lessonHref(first.id)}>
              Start lesson 1: {first.title}
            </a>
          </p>
        )}
      </section>
    );
  }

  const { attempts, due } = data;
  const now = new Date();
  const streak = streakInfo(attempts, now);
  const mastery = masteryByLesson(curriculum, attempts).filter((m) => m.attempted > 0);
  const known = mastery.reduce((n, m) => n + m.mastered, 0);
  const tracked = mastery.reduce((n, m) => n + m.attempted, 0);
  const pct = tracked > 0 ? Math.round((known / tracked) * 100) : 0;

  return (
    <section class="hero rise">
      <p class="hero-eyebrow">
        {streak.currentStreak > 0
          ? `Day ${streak.currentStreak} of the streak`
          : "The streak starts today"}
      </p>
      <h2 class="hero-title hero-title-data">
        <span class="hero-figure">{pct}%</span> of what you've met,
        <br />
        you currently know.
      </h2>
      <p class="hero-sub">
        {tracked} questions tracked · {doneCount}/{totalLessons} lessons done
        {due === 0 && data.nextDue
          ? ` · next review ${new Date(data.nextDue).toLocaleDateString()}`
          : ""}
      </p>
      <p class="hero-actions">
        {due > 0 ? (
          <a class="btn btn-lg" href="#/review">
            Review {due} due question{due === 1 ? "" : "s"}
          </a>
        ) : continueLesson ? (
          <a class="btn btn-lg" href={lessonHref(continueLesson.id)}>
            Continue: {continueLesson.title}
          </a>
        ) : (
          <a class="btn btn-lg" href={quizHref(curriculum.modules[0]!.lessons[0]!.id)}>
            All lessons done. Requiz yourself
          </a>
        )}
        <a class="hero-secondary" href="#/dashboard">
          Full progress →
        </a>
      </p>
    </section>
  );
}

/* First-run rail: teach the loop in the app's own visual language. */
function HowItWorks() {
  return (
    <section>
      <h3 class="dash-section">How it works</h3>
      <ul class="loop-steps">
        <li>
          <span class="via" />
          Read a lesson. Every claim carries its sources.
        </li>
        <li>
          <span class="via ringed" />
          Take its quiz. Every answer is saved on this device, instantly.
        </li>
        <li>
          <span class="via filled" />
          Missed questions come back tomorrow; known ones wait longer. The streak and
          mastery numbers up top do the honest bookkeeping.
        </li>
      </ul>
    </section>
  );
}

function ActivityPanel({ data }: { data: ProgressData | null }) {
  if (!data || data.attempts.length === 0) return null;
  const streak = streakInfo(data.attempts, new Date());
  return (
    <section>
      <h3 class="dash-section">Study days · last 8 weeks</h3>
      <StreakCalendar activeDays={streak.activeDays} now={new Date()} />
      {data.due === 0 && data.nextDue && (
        <p class="rail-note">
          Reviews up to date. Next: {new Date(data.nextDue).toLocaleDateString()}
        </p>
      )}
    </section>
  );
}
