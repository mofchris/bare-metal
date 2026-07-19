// Hash-based routing (D-016): GitHub Pages serves static files only, so
// history-API routes like /lesson/m1/x would 404 on refresh or direct link.
// Hash routes (#/lesson/m1/x) never hit the server — refresh, bookmarks, and
// offline all just work. Depends on: nothing. Depended on by: app.tsx.

export type Route =
  | { screen: "home" }
  | { screen: "lesson"; lessonId: string }
  | { screen: "quiz"; lessonId: string }
  | { screen: "review" }
  | { screen: "dashboard" };

/** Parse a location.hash value. Anything unrecognized falls back to home. */
export function parseRoute(hash: string): Route {
  if (hash === "#/review") return { screen: "review" };
  if (hash === "#/dashboard") return { screen: "dashboard" };
  // Lesson ids contain "/" (e.g. "m1/01-memory-hierarchy"), so everything
  // after the prefix is the id — no further splitting.
  for (const screen of ["lesson", "quiz"] as const) {
    const prefix = `#/${screen}/`;
    if (hash.startsWith(prefix) && hash.length > prefix.length) {
      return { screen, lessonId: decodeURIComponent(hash.slice(prefix.length)) };
    }
  }
  return { screen: "home" };
}

/** Build the href for a lesson link — single source of truth for the format. */
export function lessonHref(lessonId: string): string {
  return `#/lesson/${lessonId}`;
}

/** Build the href for a lesson's quiz. */
export function quizHref(lessonId: string): string {
  return `#/quiz/${lessonId}`;
}
