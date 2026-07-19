// Writes dist/sw.js from the built dist/ folder. Runs as the last build step
// (`npm run build:sw` — see package.json). Depends on: generate.ts.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateServiceWorker } from "./generate.ts";

const distDir = join(process.cwd(), "dist");
const { version, urls } = writeServiceWorker(distDir);
console.log(`sw.js generated: ${urls.length} precached URLs, cache metal-${version}`);

function writeServiceWorker(dir: string) {
  const build = generateServiceWorker(dir);
  writeFileSync(join(dir, "sw.js"), build.source);
  return build;
}
