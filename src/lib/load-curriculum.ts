// Loads and shape-checks curriculum.json at runtime.
// Depends on: curriculum.ts (types). Depended on by: app.tsx.
//
// The content compiler already validated the content deeply at build time
// (D-005); this check only guards against transport-level failures — a 404
// from a bad deploy, a truncated file, a stale cache — and turns them into
// error messages a person can act on instead of a blank screen.

import type { Curriculum } from "./curriculum";

export async function loadCurriculum(): Promise<Curriculum> {
  const url = `${import.meta.env.BASE_URL}curriculum.json`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      `Could not fetch ${url} — no network and no cached copy. ` +
        `Open the app once while online to make it available offline.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Fetching ${url} returned HTTP ${response.status} — the deploy may be ` +
        `broken; check that the build ran "npm run build:content".`,
    );
  }
  return validateCurriculumShape(await response.json(), url);
}

/** Throws with a specific message if `data` is not a plausible Curriculum. */
export function validateCurriculumShape(data: unknown, source: string): Curriculum {
  const fail = (what: string): never => {
    throw new Error(`${source} is not a valid compiled curriculum: ${what}`);
  };
  if (typeof data !== "object" || data === null) fail("not a JSON object");
  const c = data as Record<string, unknown>;
  if (typeof c["contentVersion"] !== "string") fail("missing contentVersion");
  if (!Array.isArray(c["modules"]) || c["modules"].length === 0) {
    fail("modules missing or empty");
  }
  for (const m of c["modules"] as unknown[]) {
    const mod = m as Record<string, unknown>;
    if (typeof mod?.["id"] !== "string" || !Array.isArray(mod["lessons"])) {
      fail("module entry missing id or lessons");
    }
  }
  return data as Curriculum;
}
