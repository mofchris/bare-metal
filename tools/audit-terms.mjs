// One-off audit (not shipped): does any lesson use a GLOSSARY term BEFORE the
// lesson that owns its grounding? This is the check D-025 deferred from the
// compiler, run by hand against the finished content pass.
import { readFileSync } from "node:fs";

const ROOT = "C:/Users/mofch/OneDrive/Desktop/Projects/BARE METAL/content";

// Curriculum reading order — the sequence a learner actually walks.
const ORDER = [
  ["m1/01", "m1-hardware-foundations/lessons/01-memory-hierarchy.md"],
  ["m1/02", "m1-hardware-foundations/lessons/02-cpu-architecture.md"],
  ["m1/03", "m1-hardware-foundations/lessons/03-three-budgets.md"],
  ["m1/04", "m1-hardware-foundations/lessons/04-roofline-model.md"],
  ["m1/05", "m1-hardware-foundations/lessons/05-gpus-overview.md"],
  ["m2/01", "m2-measurement/lessons/01-why-timing-is-hard.md"],
  ["m2/02", "m2-measurement/lessons/02-benchmark-statistics.md"],
  ["m2/03", "m2-measurement/lessons/03-profiling.md"],
  ["m2/04", "m2-measurement/lessons/04-benchmarking-ml.md"],
  ["m3/01", "m3-numerics/lessons/01-ieee-754.md"],
  ["m3/02", "m3-numerics/lessons/02-fp16-bf16.md"],
  ["m3/03", "m3-numerics/lessons/03-int8-quantization.md"],
  ["m3/04", "m3-numerics/lessons/04-failure-modes.md"],
  ["m4/01", "m4-data-pipelines/lessons/01-input-pipeline.md"],
  ["m4/02", "m4-data-pipelines/lessons/02-overlap.md"],
  ["m4/03", "m4-data-pipelines/lessons/03-storage-formats.md"],
  ["m4/04", "m4-data-pipelines/lessons/04-pipeline-health.md"],
  ["m5/01", "m5-training-mechanics/lessons/01-autodiff.md"],
  ["m5/02", "m5-training-mechanics/lessons/02-memory-bill.md"],
  ["m5/03", "m5-training-mechanics/lessons/03-batch-size.md"],
  ["m5/04", "m5-training-mechanics/lessons/04-memory-tricks.md"],
];

const position = new Map(ORDER.map(([id], i) => [id, i]));
const bodies = ORDER.map(([id, rel]) => [
  id,
  readFileSync(`${ROOT}/modules/${rel}`, "utf8"),
]);

// Parse the ledger's tables: | term | m3/02 | gloss |
// Skip everything above "## Hardware and systems terms" — the table up there
// documents the OLD bugs (was-used vs was-explained), not current ownership.
const ledger = readFileSync(`${ROOT}/GLOSSARY.md`, "utf8");
const rows = ledger
  .slice(ledger.indexOf("## Hardware and systems terms"))
  .split("\n")
  .map((line) => line.match(/^\|([^|]+)\|\s*(m\d\/\d\d)\s*\|/))
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
