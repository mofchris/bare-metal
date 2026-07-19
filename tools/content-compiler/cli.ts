// Content compiler CLI: compiles content/ → public/curriculum.json.
// Run via `npm run build:content` (which every build and dev run invokes).
// Depends on: compile.ts. Depended on by: package.json scripts only.
//
// Output goes to public/ so Vite copies it verbatim into dist/ and the app
// can fetch it at runtime (it stays OUT of the JS bundle — content updates
// shouldn't invalidate cached code, and vice versa).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileContent, ContentError } from "./compile.ts";

const root = process.cwd();
const outFile = join(root, "public", "curriculum.json");

try {
  const curriculum = compileContent(join(root, "content"));
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(outFile, JSON.stringify(curriculum, null, 2) + "\n");

  const lessons = curriculum.modules.reduce((n, m) => n + m.lessons.length, 0);
  const questions = curriculum.modules.reduce((n, m) => n + m.questions.length, 0);
  console.log(
    `content compiled: ${curriculum.modules.length} module(s), ${lessons} lesson(s), ` +
      `${questions} question(s) → ${outFile} (version ${curriculum.contentVersion})`,
  );
} catch (e) {
  if (e instanceof ContentError) {
    console.error(e.message);
    process.exit(1); // fail the build — malformed content never ships (D-005)
  }
  throw e;
}
