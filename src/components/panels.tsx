// Shared progress panels: streak calendar, run trend, weakest areas, mastery
// bars. Depends on: lib/stats, lib/route. Depended on by: home.tsx (side
// rail) and dashboard.tsx (detail page) — one visual vocabulary, two screens.

import { lessonHref } from "../lib/route";
import { localDateKey, type LessonMastery, type RunSummary } from "../lib/stats";

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

/* 8-week binary calendar, columns = weeks, ending today. Cell titles carry
   the date + state; the streak number lives in the hero/tiles. */
export function StreakCalendar({
  activeDays,
  now,
}: {
  activeDays: Set<string>;
  now: Date;
}) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const days: { key: string; active: boolean; today: boolean }[] = [];
  for (let i = 55; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY_MS);
    const key = localDateKey(date);
    days.push({ key, active: activeDays.has(key), today: i === 0 });
  }
  return (
    <div class="streak-grid">
      {days.map((d) => (
        <span
          key={d.key}
          class={`streak-cell${d.active ? " active" : ""}${d.today ? " today" : ""}`}
          title={`${d.key}: ${d.active ? "studied" : "no study"}`}
        />
      ))}
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
