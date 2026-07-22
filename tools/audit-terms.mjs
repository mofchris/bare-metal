// One-off audit (not shipped): does any lesson use a GLOSSARY term BEFORE the
// lesson that owns its grounding? This is the check D-025 deferred from the
// compiler, run by hand against the finished content pass.
import { readdirSync, readFileSync } from "node:fs";

const ROOT = "C:/Users/mofch/OneDrive/Desktop/Projects/BARE METAL/content";

// Curriculum reading order — the sequence a learner actually walks. Derived
// from module.yaml rather than hardcoded, so adding a module needs no edit
// here. (It was hardcoded once, and every M6 row reported "bad owner".)

const MODULES_DIR = `${ROOT}/modules`;

/** Module directories in curriculum order — the m<N>- prefix is that order. */
function modulesInOrder() {
  return readdirSync(MODULES_DIR)
    .filter((name) => /^m\d+-/.test(name))
    .sort((a, b) => Number(a.match(/^m(\d+)/)[1]) - Number(b.match(/^m(\d+)/)[1]));
}

/** Lesson order inside a module is the explicit `lessons:` list in its yaml. */
function lessonsOf(moduleDir) {
  const yaml = readFileSync(`${MODULES_DIR}/${moduleDir}/module.yaml`, "utf8");
  const list = yaml.slice(yaml.indexOf("lessons:"));
  return [...list.matchAll(/^\s*-\s*(\S+)\s*$/gm)].map((m) => m[1]);
}

const ORDER = modulesInOrder().flatMap((dir) => {
  const moduleNumber = dir.match(/^m(\d+)/)[1];
  return lessonsOf(dir).map((slug) => [
    // Short id used in the ledger's "First grounded" column, e.g. "m6/02".
    `m${moduleNumber}/${slug.slice(0, 2)}`,
    `${dir}/lessons/${slug}.md`,
  ]);
});

const position = new Map(ORDER.map(([id], i) => [id, i]));
const bodies = ORDER.map(([id, rel]) => [
  id,
  readFileSync(`${MODULES_DIR}/${rel}`, "utf8"),
]);

// Parse the ledger's tables: | term | m3/02 | gloss |
// Skip everything above "## Hardware and systems terms" — the table up there
// documents the OLD bugs (was-used vs was-explained), not current ownership.
const ledger = readFileSync(`${ROOT}/GLOSSARY.md`, "utf8");
const rows = ledger
  .slice(ledger.indexOf("## Hardware and systems terms"))
  .split("\n")
  .map((line) => line.match(/^\|([^|]+)\|\s*(m\d+\/\d\d)\s*\|/))
  .filter(Boolean)
  .map((m) => ({ cell: m[1].trim(), owner: m[2] }));

// Terms too generic to search literally, or whose plain-English word is
// unavoidable prose ("scale", "issue", "loss" as in "loss of precision").
const SKIP = new Set([
  "issue",
  "scale",
  "range",
  "model",
  "layer",
  "batch",
  "thread",
  "host",
  "device",
  "shard",
  "channel",
  "the tape",
  "warmup",
  "converge",
  "accumulator",
  "derivative",
  "chain rule",
  "generalization",
  "process",
  "page",
]);

const findings = [];
for (const { cell, owner } of rows) {
  const ownerAt = position.get(owner);
  if (ownerAt === undefined) {
    findings.push({ kind: "BAD OWNER", cell, owner });
    continue;
  }
  const candidates = cell
    .split(/,|\bvs\b|\//)
    .map((s) => s.replace(/\*\*|`|\(.*?\)/g, "").trim())
    // Keep the original case of anything with an interior capital (ZeRO,
    // LoRA, SIMD, QAT) — those are names, and lowercasing them makes them
    // collide with ordinary prose words.
    .map((s) => (/[A-Z]{2,}/.test(s) ? s : s.toLowerCase()))
    .filter((s) => s.length > 3 && !SKIP.has(s));

  for (const term of candidates) {
    // Names match case — "ZeRO" the algorithm is not the word "zero".
    const isAcronym = /[A-Z]{2,}/.test(term);
    const re = new RegExp(
      `\\b${term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`,
      isAcronym ? "" : "i",
    );
    for (const [id, body] of bodies) {
      if (position.get(id) >= ownerAt) break; // at or after its home: fine
      // Ignore the frontmatter block — objectives/sources are metadata.
      const prose = body.replace(/^---[\s\S]*?\n---\n/, "");
      if (re.test(prose)) {
        findings.push({ kind: "USED EARLY", term, owner, usedIn: id });
        break;
      }
    }
  }
}

if (!findings.length) {
  console.log("CLEAN — no ledger term is used before the lesson that grounds it.");
} else {
  console.log(`${findings.length} to review:\n`);
  for (const f of findings) {
    console.log(
      f.kind === "USED EARLY"
        ? `  "${f.term}" grounded in ${f.owner} but appears in ${f.usedIn}`
        : `  bad owner ${f.owner} for "${f.cell}"`,
    );
  }
}
