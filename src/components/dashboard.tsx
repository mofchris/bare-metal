// Dashboard: the detail view of progress — stat tiles plus the full
// mastery-by-lesson list. The overview lives on home; this page is for
// digging. Depends on: lib/curriculum, lib/stats, lib/srs,
// lib/progress-store, lib/route, components/panels. Depended on by: app.tsx.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum } from "../lib/curriculum";
import type { AttemptRecord, ProgressDb } from "../lib/progress-store";
import { dueQuestionIds } from "../lib/srs";
import { lessonHref } from "../lib/route";
import { localDateKey, masteryByLesson, runHistory, weakestLessons } from "../lib/stats";
import { studyStreak, type StudyTimeRecord } from "../lib/study-time";
import { MasteryBar, RunTrend, StreakCalendar, WeakestAreas } from "./panels";

interface Data {
  attempts: AttemptRecord[];
  studyTime: StudyTimeRecord[];
  dueCount: number;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Data };

export function Dashboard({
  curriculum,
  db,
}: {
  curriculum: Curriculum;
  db: ProgressDb | null;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!db) return;
    Promise.all([db.allAttempts(), db.allStudyTime(), db.allSrsStates()])
      .then(([attempts, studyTime, srs]) =>
        setState({
          status: "ready",
          data: { attempts, studyTime, dueCount: dueQuestionIds(srs, new Date()).length },
        }),
      )
      .catch((e: unknown) =>
        setState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  }, [db]);

  if (!db) {
    return (
      <p class="quiz-note-warn">
        The dashboard needs progress storage, which is unavailable in this browser.
      </p>
    );
  }
  if (state.status === "loading") return <p class="status">Loading dashboard…</p>;
  if (state.status === "error") {
    return (
      <div class="error-block">
        <h2>Couldn't load the dashboard</h2>
        <p>{state.message}</p>
      </div>
    );
  }

  const { attempts, studyTime, dueCount } = state.data;
  if (attempts.length === 0) {
    return (
      <div>
        <nav class="crumbs">
          <a href="#/">← Home</a>
        </nav>
        <h2>No study history yet</h2>
        <p>
          Take any lesson quiz and this page starts filling in.{" "}
          <a href="#/">Start from the first lesson.</a>
        </p>
      </div>
    );
  }

  const now = new Date();
  const mastery = masteryByLesson(curriculum, attempts);
  const attempted = mastery.filter((m) => m.attempted > 0);
  const masteredTotal = attempted.reduce((n, m) => n + m.mastered, 0);
  const attemptedTotal = attempted.reduce((n, m) => n + m.attempted, 0);
  const attemptDays = new Set(attempts.map((a) => localDateKey(new Date(a.at))));
  const streak = studyStreak(studyTime, attemptDays, now);

  return (
    <div>
      <nav class="crumbs">
        <a href="#/">← Home</a>
      </nav>
      <h2>Progress</h2>

      <div class="stat-tiles">
        <StatTile value={`${streak.current}`} label="day streak" />
        <StatTile
          value={
            attemptedTotal > 0
              ? `${Math.round((masteredTotal / attemptedTotal) * 100)}%`
              : "—"
          }
          label="current mastery"
        />
        <StatTile value={`${attemptedTotal}`} label="questions tracked" />
        <StatTile value={`${dueCount}`} label="due for review" />
      </div>

      <RunTrend runs={runHistory(attempts, 10)} />
      <section>
        <h3 class="dash-section">Study streak</h3>
        <StreakCalendar records={studyTime} attemptDays={attemptDays} now={now} />
      </section>
      <WeakestAreas weakest={weakestLessons(mastery, 3)} />

      <h3 class="dash-section">Mastery by lesson</h3>
      <ul class="mastery-list">
        {mastery.map((m) => (
          <li key={m.lessonId}>
            <a href={lessonHref(m.lessonId)}>{m.lessonTitle}</a>
            <MasteryBar mastery={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div class="stat-tile">
      <span class="stat-value">{value}</span>
      <span class="stat-label">{label}</span>
    </div>
  );
}
