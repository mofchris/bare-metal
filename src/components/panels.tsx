// Shared progress panels: streak calendar, run trend, weakest areas, mastery
// bars. Depends on: lib/stats, lib/route. Depended on by: home.tsx (side
// rail) and dashboard.tsx (detail page) — one visual vocabulary, two screens.

import { lessonHref } from "../lib/route";
import { localDateKey, type LessonMastery, type RunSummary } from "../lib/stats";
import {
  DAILY_GOAL_SECONDS,
  secondsByDay,
  studyStreak,
  type StudyTimeRecord,
} from "../lib/study-time";

/* Single-series column list: height ∝ accuracy, baseline-anchored; per-column
   title tooltip; only the latest run gets a direct label. */
export function RunTrend({ runs }: { runs: RunSummary[] }) {
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

/* The streak calendar (D-024): a month view of the 30-minutes-a-day goal.
   Cell states — goal met (filled copper), some study (copper ring), nothing
   (dim), today (outlined, with live minutes underneath). Cell titles carry
   the exact minutes, so color is never the only carrier. */
export function StreakCalendar({
  records,
  attemptDays,
  now,
}: {
  records: StudyTimeRecord[];
  attemptDays: Set<string>;
  now: Date;
}) {
  const streak = studyStreak(records, attemptDays, now);
  const seconds = secondsByDay(records);
  const todayKey = localDateKey(now);
  const todayMinutes = Math.floor(streak.todaySeconds / 60);
  const goalMinutes = DAILY_GOAL_SECONDS / 60;

  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first column for day 1 (getDay(): 0 = Sunday).
  const lead = (first.getDay() + 6) % 7;
  const monthName = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const cellFor = (dayNum: number) => {
    const key = localDateKey(new Date(year, month, dayNum));
    const secs = seconds.get(key) ?? 0;
    const mins = Math.floor(secs / 60);
    const future = key > todayKey;
    const state = future
      ? "future"
      : streak.countedDays.has(key)
        ? "met"
        : secs > 0
          ? "some"
          : "none";
    return (
      <span
        key={key}
        class={`cal-cell ${state}${key === todayKey ? " today" : ""}`}
        title={
          future
            ? key
            : `${key} · ${mins} min${streak.countedDays.has(key) ? " · goal met" : ""}`
        }
      >
        {dayNum}
      </span>
    );
  };

  return (
    <div class="streak-cal">
      <div class="streak-cal-head">
        <span class="streak-cal-count">
          <strong>{streak.current}</strong> day streak
        </span>
        <span class="streak-cal-today">
          today {Math.min(todayMinutes, goalMinutes)}/{goalMinutes} min
        </span>
      </div>
      <div
        class="streak-cal-todaybar"
        role="img"
        aria-label={`${todayMinutes} of ${goalMinutes} minutes today`}
      >
        <span
          class="streak-cal-todayfill"
          style={{ width: `${Math.min((todayMinutes / goalMinutes) * 100, 100)}%` }}
        />
      </div>
      <p class="streak-cal-month">{monthName}</p>
      <div class="cal-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={`h${i}`} class="cal-head">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => cellFor(i + 1))}
      </div>
      <p class="rail-note">
        A day counts at {goalMinutes}+ minutes of lessons, quizzes, or reviews.
      </p>
    </div>
  );
}

export function WeakestAreas({ weakest }: { weakest: LessonMastery[] }) {
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

export function MasteryBar({ mastery }: { mastery: LessonMastery }) {
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
