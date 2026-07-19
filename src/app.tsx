// App shell: loads the curriculum, owns the route, and renders the current
// screen. Depends on: lib/load-curriculum, lib/route, lib/lookup, components/.
// Depended on by: main.tsx.
//
// Every state this component can be in is rendered explicitly — loading,
// load failure, unknown lesson id — because a blank or half-drawn screen is
// a silent failure (CLAUDE.md).

import { useEffect, useState } from "preact/hooks";
import type { Curriculum } from "./lib/curriculum";
import { loadCurriculum } from "./lib/load-curriculum";
import { parseRoute, type Route } from "./lib/route";
import { findLesson, questionsFor } from "./lib/lookup";
import { openProgressDb, type ProgressDb } from "./lib/progress-store";
import { Home } from "./components/home";
import { LessonView } from "./components/lesson-view";
import { Quiz } from "./components/quiz";
import { Review } from "./components/review";
import { Dashboard } from "./components/dashboard";
import { Backup } from "./components/backup";
import { Gated } from "./components/gated";
import { lessonHref } from "./lib/route";
import { examUnlocked, lessonUnlocked, moduleUnlocked, PASS_MARK } from "./lib/gating";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; curriculum: Curriculum };

// Storage settles to either an open db or a definitive failure. Screens are
// not rendered while it's "opening": otherwise a fast first quiz answer can
// race the async open and be silently unrecorded (found in Stage B testing —
// the summary would then claim answers were saved that never were).
type DbState = { status: "opening" } | { status: "ready"; db: ProgressDb | null };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [dbState, setDbState] = useState<DbState>({ status: "opening" });
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    loadCurriculum()
      .then((curriculum) => setLoad({ status: "ready", curriculum }))
      .catch((e: unknown) =>
        setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      );
    // Progress storage failing (e.g. hard-private browsing modes) must not
    // brick studying — the app stays usable (db: null) and says out loud
    // that nothing is being recorded.
    openProgressDb()
      .then((db) => setDbState({ status: "ready", db }))
      .catch((e: unknown) => {
        setDbError(e instanceof Error ? e.message : String(e));
        setDbState({ status: "ready", db: null });
      });
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRoute(location.hash));
      // A hash change is a page navigation as far as the reader is concerned.
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Reading surfaces stay a centered column; home manages the full width.
  const narrow = route.screen !== "home";

  return (
    <div class="shell">
      <header class="shell-header">
        <h1>
          <a href="#/">Metal</a>
        </h1>
        <nav class="shell-nav">
          <a href="#/">Home</a>
          <a href="#/dashboard">Progress</a>
          <a href="#/review">Review</a>
          <a href="#/backup">Backup</a>
        </nav>
      </header>
      {dbError && (
        <p class="warn-banner">
          Progress saving is unavailable in this browser ({dbError}). The app still works,
          but quiz results won't be recorded.
        </p>
      )}
      <main class={narrow ? "shell-main narrow" : "shell-main"}>
        {dbState.status === "opening" ? (
          <p class="status">Loading…</p>
        ) : (
          <Screen load={load} route={route} db={dbState.db} />
        )}
      </main>
    </div>
  );
}

function Screen({
  load,
  route,
  db,
}: {
  load: LoadState;
  route: Route;
  db: ProgressDb | null;
}) {
  if (load.status === "loading") {
    return <p class="status">Loading curriculum…</p>;
  }
  if (load.status === "error") {
    return (
      <div class="error-block">
        <h2>Couldn't load the curriculum</h2>
        <p>{load.message}</p>
      </div>
    );
  }
  if (route.screen === "lesson" || route.screen === "quiz") {
    const location = findLesson(load.curriculum, route.lessonId);
    if (!location) {
      return (
        <div class="error-block">
          <h2>Lesson not found</h2>
          <p>
            No lesson has id "{route.lessonId}" — the link may be stale.{" "}
            <a href="#/">Back to all modules.</a>
          </p>
        </div>
      );
    }
    const lessonGate = (
      statuses: Map<string, import("./lib/progress-store").LessonProgressRecord>,
      exams: Map<string, import("./lib/progress-store").ExamResultRecord>,
    ): string | null => {
      if (!moduleUnlocked(location.module, exams)) {
        return `This module is locked. Pass the previous module's exam (${PASS_MARK}%) to open it.`;
      }
      if (!lessonUnlocked(location.module, location.lesson.id, statuses)) {
        return `This lesson is locked. Score ${PASS_MARK}% on the previous lesson's quiz to open it.`;
      }
      return null;
    };
    return (
      <Gated db={db} check={lessonGate}>
        {route.screen === "quiz" ? (
          <Quiz
            title={location.module.title}
            backHref={lessonHref(location.lesson.id)}
            backLabel={location.lesson.title}
            questions={questionsFor(location.module, location.lesson.id)}
            db={db}
            markDoneLessonId={location.lesson.id}
          />
        ) : (
          <LessonView location={location} />
        )}
      </Gated>
    );
  }
  if (route.screen === "exam") {
    const module = load.curriculum.modules.find((m) => m.id === route.moduleId);
    if (!module) {
      return (
        <div class="error-block">
          <h2>Module not found</h2>
          <p>
            No module has id "{route.moduleId}". <a href="#/">Back home.</a>
          </p>
        </div>
      );
    }
    return (
      <Gated
        db={db}
        check={(statuses, exams) => {
          if (!moduleUnlocked(module, exams)) {
            return `This module is locked. Pass the previous module's exam (${PASS_MARK}%) to open it.`;
          }
          if (!examUnlocked(module, statuses)) {
            return `The exam opens once every lesson in this module is passed at ${PASS_MARK}%.`;
          }
          return null;
        }}
      >
        <Quiz
          title={`${module.title} — module exam`}
          backHref="#/"
          backLabel="Home"
          questions={module.questions}
          db={db}
          examModuleId={module.id}
        />
      </Gated>
    );
  }
  if (route.screen === "review") {
    return <Review curriculum={load.curriculum} db={db} />;
  }
  if (route.screen === "dashboard") {
    return <Dashboard curriculum={load.curriculum} db={db} />;
  }
  if (route.screen === "backup") {
    return <Backup db={db} />;
  }
  return <Home curriculum={load.curriculum} db={db} />;
}
