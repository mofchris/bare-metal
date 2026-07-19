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
import { findLesson } from "./lib/lookup";
import { Home } from "./components/home";
import { LessonView } from "./components/lesson-view";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; curriculum: Curriculum };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));

  useEffect(() => {
    loadCurriculum()
      .then((curriculum) => setLoad({ status: "ready", curriculum }))
      .catch((e: unknown) =>
        setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      );
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

  return (
    <div class="shell">
      <header class="shell-header">
        <h1>
          <a href="#/">Metal</a>
        </h1>
        <p class="tagline">Machine Learning Systems, learned properly.</p>
      </header>
      <main class="shell-main">
        <Screen load={load} route={route} />
      </main>
    </div>
  );
}

function Screen({ load, route }: { load: LoadState; route: Route }) {
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
  if (route.screen === "lesson") {
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
    return <LessonView location={location} />;
  }
  return <Home curriculum={load.curriculum} />;
}
