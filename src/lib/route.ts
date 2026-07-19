// Hash-based routing (D-016): GitHub Pages serves static files only, so
// history-API routes like /lesson/m1/x would 404 on refresh or direct link.
// Hash routes (#/lesson/m1/x) never hit the server — refresh, bookmarks, and
// offline all just work. Depends on: nothing. Depended on by: app.tsx.

export type Route = { screen: "home" } | { screen: "lesson"; lessonId: string };

/** Parse a location.hash value. Anything unrecognized falls back to home. */
export function parseRoute(hash: string): Route {
  const lessonId = hash.startsWith("#/lesson/") ? hash.slice("#/lesson/".length) : "";
  if (lessonId !== "") {
    // Lesson ids contain "/" (e.g. "m1/01-memory-hierarchy"), so everything
    // after the prefix is the id — no further splitting.
    return { screen: "lesson", lessonId: decodeURIComponent(lessonId) };
  }
  return { screen: "home" };
}

/** Build the href for a lesson link — single source of truth for the format. */
export function lessonHref(lessonId: string): string {
  return `#/lesson/${lessonId}`;
}
