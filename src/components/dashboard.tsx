// Dashboard: mastery per lesson, run trend, streak calendar, weakest areas —
// all derived on the fly from the attempts store (lib/stats). Depends on:
// lib/curriculum (types), lib/stats, lib/srs, lib/progress-store, lib/route.
// Depended on by: app.tsx.
//
// Visualization choices follow the dataviz method: headline numbers are stat
// tiles (not charts); the trend is a single-series column list (one axis, no
// legend needed, values in text tokens); the calendar is a binary cell grid
// with accessible titles, backed by the streak number so color is never the
// only carrier.

import { useEffect, useState } from "preact/hooks";
import type { Curriculum } from "../lib/curriculum";
import type { AttemptRecord, ProgressDb } from "../lib/progress-store";
import { dueQuestionIds } from "../lib/srs";
import { lessonHref } from "../lib/route";
import {
  localDateKey,
  masteryByLesson,
  runHistory,
  streakInfo,
  weakestLessons,
  type LessonMastery,
  type RunSummary,
} from "../lib/stats";

interface Data {
  attempts: AttemptRecord[];
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
    Promise.all([db.allAttempts(), db.allSrsStates()])
      .then(([attempts, srs]) =>
        setState({
          status: "ready",
          data: { attempts, dueCount: dueQuestionIds(srs, new Date()).length },
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

  const { attempts, dueCount } = state.data;
  if (attempts.length === 0) {
    return (
      <div>
        <nav class="crumbs">
          <a href="#/">← All modules</a>
        </nav>
        <h2>No study history yet</h2>
        <p>Take any lesson quiz and this page starts filling in.</p>
      </div>
    );
  }

  const now = new Date();
  const mastery = masteryByLesson(curriculum, attempts);
  const attempted = mastery.filter((m) => m.attempted > 0);
  const masteredTotal = attempted.reduce((n, m) => n + m.mastered, 0);
  const attemptedTotal = attempted.reduce((n, m) => n + m.attempted, 0);
  const streak = streakInfo(attempts, now);
  const runs = runHistory(attempts, 10);
  const weakest = weakestLessons(mastery, 3);

  return (
    <div>
      <nav class="crumbs">
        <a href="#/">← All modules</a>
      </nav>
      <h2>Progress</h2>

      <div class="stat-tiles">
        <StatTile value={`${streak.currentStreak}`} label="day streak" />
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

      <RunTrend runs={runs} />
      <StreakCalendar activeDays={streak.activeDays} now={now} />
      <WeakestAreas weakest={weakest} />

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

/* Single-series column list: height ∝ accuracy, 0–100% scale anchored at the
   baseline; per-column title tooltip; only the latest run gets a direct label. */
function RunTrend({ runs }: { runs: RunSummary[] }) {
  if (runs.length < 2) return null;
  return (
    <section>
      <h3 class="dash-section">Last {runs.length} quiz runs</h3>
      <div
        class="run-trend"
        role="img"
        aria-label="Accuracy per quiz run, oldest to newest"
      >
        {runs.map((run, i) => {
          const pct = Math.round((run.correct / run.total) * 100);
          const latest = i === runs.length - 1;
          return (
            <div
              key={run.sessionId}
              class="run-col"
              title={`${new Date(run.startedAt).toLocaleDateString()}: ${run.correct}/${run.total} (${pct}%)`}
            >
              {latest && <span class="run-label">{pct}%</span>}
              <div class="run-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* 8-week binary calendar, columns = weeks, ending today. Cell titles carry
   the date + state; the streak stat tile carries the number. */
function StreakCalendar({ activeDays, now }: { activeDays: Set<string>; now: Date }) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const days: { key: string; active: boolean; today: boolean }[] = [];
  for (let i = 55; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY_MS);
    const key = localDateKey(date);
    days.push({ key, active: activeDays.has(key), today: i === 0 });
  }
  return (
    <section>
      <h3 class="dash-section">Study days — last 8 weeks</h3>
      <div class="streak-grid">
        {days.map((d) => (
          <span
            key={d.key}
            class={`streak-cell${d.active ? " active" : ""}${d.today ? " today" : ""}`}
            title={`${d.key}: ${d.active ? "studied" : "no study"}`}
          />
        ))}
      </div>
    </section>
  );
}

function WeakestAreas({ weakest }: { weakest: LessonMastery[] }) {
  if (weakest.length === 0) return null;
  return (
    <section>
      <h3 class="dash-section">Weakest areas</h3>
      <ul class="mastery-list">
        {weakest.map((m) => (
          <li key={m.lessonId}>
            <a href={lessonHref(m.lessonId)}>{m.lessonTitle}</a>
            <MasteryBar mastery={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MasteryBar({ mastery }: { mastery: LessonMastery }) {
  const pct = mastery.masteryPct;
  return (
    <span class="mastery-cell">
      <span class="mastery-bar-track">
        <span class="mastery-bar-fill" style={{ width: `${pct ?? 0}%` }} />
      </span>
      <span class="lesson-meta">
        {pct === null ? "not started" : `${mastery.mastered}/${mastery.attempted} known`}
      </span>
    </span>
  );
}
