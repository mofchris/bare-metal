// Content compiler core: reads content/modules/**, validates everything
// against the schemas in docs/DATA_MODEL.md, renders Markdown to HTML, and
// returns a Curriculum object — or throws ContentError listing EVERY problem
// found (not just the first), each tagged with the offending file.
// Depends on: yaml, marked, src/lib/curriculum.ts (types only).
// Depended on by: cli.ts (build entry point), compile.test.ts.
//
// Design rule (D-005 / CLAUDE.md): authored content is untrusted input. The
// compiler is the wall — nothing malformed may pass, and nothing may fail
// silently. Validation is hand-rolled rather than schema-library-based
// (D-015): the checks are few, the error messages matter more than the
// framework, and a stranger can read plain conditionals.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { marked } from "marked";
import type {
  Curriculum,
  Lesson,
  Module,
  Question,
  Quote,
} from "../../src/lib/curriculum.ts";
import { evaluateExpression } from "./expression.ts";

export class ContentError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Content compilation failed with ${problems.length} problem(s):\n` +
        problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ContentError";
    this.problems = problems;
  }
}

/** Compile the content tree rooted at `contentRoot` (the folder holding modules/). */
export function compileContent(contentRoot: string): Curriculum {
  const problems: string[] = [];
  const modulesDir = join(contentRoot, "modules");
  if (!existsSync(modulesDir)) {
    throw new ContentError([`${modulesDir}: modules directory not found`]);
  }

  const moduleIds = readdirSync(modulesDir)
    .filter((name) => statSync(join(modulesDir, name)).isDirectory())
    .sort();
  if (moduleIds.length === 0) {
    throw new ContentError([`${modulesDir}: no module directories found`]);
  }

  const modules: Module[] = [];
  for (const dirName of moduleIds) {
    const mod = readModule(join(modulesDir, dirName), dirName, problems);
    if (mod) modules.push(mod);
  }

  validateCrossReferences(modules, problems);
  const quotes = readQuotes(join(contentRoot, "quotes.yaml"), problems);

  if (problems.length > 0) throw new ContentError(problems);

  const sorted = topologicalSort(modules);
  // Hash of everything the app will see: any content change produces a new
  // version, which is how the service worker will know to refetch (D-008).
  // Quotes are part of "everything the app will see" — leaving them out meant
  // editing quotes.yaml shipped a file the service worker considered unchanged.
  const contentVersion = createHash("sha256")
    .update(JSON.stringify({ modules: sorted, quotes }))
    .digest("hex")
    .slice(0, 16);
  return { contentVersion, modules: sorted, quotes };
}

/**
 * Opening quotes (D-031). The file is OPTIONAL — a curriculum without one is
 * valid and simply shows no quote — but if it exists every entry is validated,
 * because a half-filled quote would render as a line with nobody's name on it.
 */
function readQuotes(file: string, problems: string[]): Quote[] {
  if (!existsSync(file)) return [];
  const parsed = parseYamlFile(file, problems);
  if (parsed === null) return [];
  if (!Array.isArray(parsed)) {
    problems.push(`${file}: expected a YAML list of quotes`);
    return [];
  }
  const quotes: Quote[] = [];
  parsed.forEach((entry, i) => {
    const where = `${file} entry ${i + 1}`;
    if (!isRecord(entry)) {
      problems.push(`${where}: expected a mapping`);
      return;
    }
    const text = requireString(entry, "text", where, problems);
    const who = requireString(entry, "who", where, problems);
    const series = requireString(entry, "series", where, problems);
    if (text && who && series) quotes.push({ text, who, series });
  });
  return quotes;
}

/* ---------------- module ---------------- */

function readModule(dir: string, dirName: string, problems: string[]): Module | null {
  const metaFile = join(dir, "module.yaml");
  if (!existsSync(metaFile)) {
    problems.push(`${metaFile}: missing module.yaml`);
    return null;
  }
  const meta = parseYamlFile(metaFile, problems);
  if (meta === null) return null;
  if (!isRecord(meta)) {
    problems.push(`${metaFile}: expected a YAML mapping at the top level`);
    return null;
  }

  const id = requireString(meta, "id", metaFile, problems);
  if (id !== null && id !== dirName) {
    // Folder name and id must agree so file paths stay greppable from ids.
    problems.push(`${metaFile}: id "${id}" does not match folder name "${dirName}"`);
  }
  const title = requireString(meta, "title", metaFile, problems);
  const prereqs = optionalStringArray(meta, "prereqs", metaFile, problems) ?? [];
  const lessonNames = requireStringArray(meta, "lessons", metaFile, problems);

  const lessons: Lesson[] = [];
  if (lessonNames !== null) {
    const lessonsDir = join(dir, "lessons");
    for (const name of lessonNames) {
      const file = join(lessonsDir, `${name}.md`);
      if (!existsSync(file)) {
        problems.push(`${metaFile}: lesson "${name}" listed but ${file} does not exist`);
        continue;
      }
      const lesson = readLesson(file, problems);
      if (lesson) lessons.push(lesson);
    }
    // Orphans: a lesson file not listed in module.yaml would silently never
    // render — that's exactly the quiet failure CLAUDE.md bans.
    if (existsSync(lessonsDir)) {
      for (const file of readdirSync(lessonsDir).sort()) {
        if (file.endsWith(".md") && !lessonNames.includes(file.slice(0, -3))) {
          problems.push(
            `${join(lessonsDir, file)}: orphan lesson — not listed in module.yaml`,
          );
        }
      }
    }
  }

  const questions = readQuestions(join(dir, "questions.yaml"), problems);

  if (id === null || title === null) return null;
  return { id, title, prereqs, lessons, questions };
}

/* ---------------- lessons ---------------- */

function readLesson(file: string, problems: string[]): Lesson | null {
  const raw = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    problems.push(`${file}: missing YAML frontmatter (--- block) at top of file`);
    return null;
  }
  let meta: unknown;
  try {
    meta = parseYaml(match[1]!);
  } catch (e) {
    problems.push(`${file}: frontmatter is not valid YAML — ${(e as Error).message}`);
    return null;
  }
  if (!isRecord(meta)) {
    problems.push(`${file}: frontmatter must be a YAML mapping`);
    return null;
  }

  const id = requireString(meta, "id", file, problems);
  const title = requireString(meta, "title", file, problems);
  const objectives = requireStringArray(meta, "objectives", file, problems);
  const sources = requireStringArray(meta, "sources", file, problems);
  const body = match[2]!.trim();
  if (body.length === 0) problems.push(`${file}: lesson body is empty`);

  if (id === null || title === null || objectives === null || sources === null) {
    return null;
  }
  const withPractice = injectPractice(body, meta["practice"], file, problems);
  return { id, title, objectives, sources, html: withPractice };
}

/* ---------------- practice problems (D-034) ----------------

   A lesson may declare practice problems in its frontmatter and place them in
   the body with a {{practice:N}} marker, so a problem sits where the argument
   actually reaches it rather than being swept to the end:

     practice:
       - level: 1
         problem: "Compute the arithmetic intensity of `c[i] = a[i] + b[i]`."
         hints:
           - "Count the FLOPs per element first."
           - "Then count every byte that moves, including the write."
         answer: "1 FLOP over 12 bytes is 0.083 FLOPs per byte."

   WHY THIS EXISTS. Every lesson had a "Check your understanding" section, but
   34 of the 43 printed "A correct answer says..." in the same paragraph as the
   question — so the eye reached the solution before the brain reached the
   problem, and there was nowhere in Metal to attempt anything. Christopher hit
   the sharpest version at m1/03, which told him to work three examples by hand
   and then worked all three for him.

   The rendered block uses native <details> elements, so hints and the answer
   stay hidden until asked for with NO JavaScript at all — it works inside the
   pre-rendered lesson HTML, offline, and with the keyboard, and there is no
   component to keep in sync. */

interface PracticeItem {
  level: number;
  problem: string;
  hints: string[];
  answer: string;
}

/** Replace every {{practice:N}} marker in `body` with its rendered block. */
function injectPractice(
  body: string,
  raw: unknown,
  file: string,
  problems: string[],
): string {
  const items = readPracticeItems(raw, file, problems);
  const used = new Set<number>();

  const html = marked.parse(body) as string;
  // The marker sits on its own line, so Markdown wraps it in <p>…</p>. Consume
  // that wrapper too: a <div> inside a <p> is invalid and browsers silently
  // re-nest it, which breaks the block's styling in ways that are painful to
  // trace back to their cause.
  const rendered = html.replace(
    /(?:<p>\s*)?\{\{\s*practice:\s*(\d+)\s*\}\}(?:\s*<\/p>)?/g,
    (_match, n: string) => {
      const index = Number(n);
      if (index < 1 || index > items.length) {
        problems.push(
          `${file}: {{practice:${index}}} has no matching entry — ` +
            `the practice list holds ${items.length}`,
        );
        return "";
      }
      used.add(index);
      return renderPractice(items[index - 1]!, index);
    },
  );

  // An authored problem with no marker would never appear on the page — the
  // silent failure this project bans.
  items.forEach((_item, i) => {
    if (!used.has(i + 1)) {
      problems.push(
        `${file}: practice entry ${i + 1} is never placed — ` +
          `add a {{practice:${i + 1}}} marker in the lesson body`,
      );
    }
  });
  return rendered;
}

function readPracticeItems(
  raw: unknown,
  file: string,
  problems: string[],
): PracticeItem[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push(`${file}: "practice" must be a list`);
    return [];
  }
  const items: PracticeItem[] = [];
  raw.forEach((entry, i) => {
    const where = `${file} practice entry ${i + 1}`;
    if (!isRecord(entry)) {
      problems.push(`${where}: expected a mapping`);
      return;
    }
    const problem = requireString(entry, "problem", where, problems);
    const answer = requireString(entry, "answer", where, problems);
    const hints = optionalStringArray(entry, "hints", where, problems) ?? [];
    const level = entry["level"] === undefined ? i + 1 : entry["level"];
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1) {
      problems.push(`${where}: "level" must be a positive integer`);
      return;
    }
    if (problem !== null && answer !== null) {
      items.push({ level, problem, hints, answer });
    }
  });
  // Difficulty is meant to climb — Christopher asked for it explicitly — so a
  // list that goes backwards is an authoring mistake, not a style choice.
  for (let i = 1; i < items.length; i++) {
    if (items[i]!.level < items[i - 1]!.level) {
      problems.push(
        `${file}: practice entry ${i + 1} is easier (level ${items[i]!.level}) than ` +
          `the one before it (level ${items[i - 1]!.level}) — problems must get harder`,
      );
    }
  }
  return items;
}

/** Inline Markdown (code spans, emphasis) without wrapping it in a paragraph. */
function renderInline(text: string): string {
  return marked.parseInline(text) as string;
}

function renderPractice(item: PracticeItem, index: number): string {
  const hints = item.hints
    .map(
      (hint, i) =>
        `<details class="practice-hint"><summary>Hint ${i + 1}</summary>` +
        `<div>${renderInline(hint)}</div></details>`,
    )
    .join("");
  return (
    `<div class="practice">` +
    `<p class="practice-label">Problem ${index} · level ${item.level}</p>` +
    `<div class="practice-problem">${renderInline(item.problem)}</div>` +
    hints +
    `<details class="practice-answer"><summary>Show the answer</summary>` +
    `<div>${renderInline(item.answer)}</div></details>` +
    `</div>`
  );
}

/* ---------------- questions ---------------- */

function readQuestions(file: string, problems: string[]): Question[] {
  if (!existsSync(file)) {
    problems.push(`${file}: missing questions.yaml (every module needs a question bank)`);
    return [];
  }
  const parsed = parseYamlFile(file, problems);
  if (parsed === null) return [];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    problems.push(`${file}: expected a non-empty YAML list of questions`);
    return [];
  }

  const questions: Question[] = [];
  parsed.forEach((entry, i) => {
    const where = `${file} entry ${i + 1}`;
    if (!isRecord(entry)) {
      problems.push(`${where}: expected a mapping`);
      return;
    }
    // A "vars" block marks a TEMPLATE: one authored question that expands into
    // many concrete ones, so the bank grows without the arithmetic being
    // transcribed by hand (D-030). Everything else is an ordinary question.
    if (entry["vars"] !== undefined) {
      questions.push(...expandTemplate(entry, where, problems));
      return;
    }
    const id = requireString(entry, "id", where, problems);
    const lesson = requireString(entry, "lesson", where, problems);
    const prompt = requireString(entry, "prompt", where, problems);
    const explanation = requireString(entry, "explanation", where, problems);
    const tags = optionalStringArray(entry, "tags", where, problems) ?? [];
    const type = entry["type"];

    if (type === "mcq") {
      const options = requireStringArray(entry, "options", where, problems);
      if (options !== null && (options.length < 2 || options.length > 6)) {
        problems.push(`${where}: mcq needs 2–6 options, got ${options.length}`);
      }
      const answer = entry["answer"];
      if (typeof answer !== "number" || !Number.isInteger(answer)) {
        problems.push(`${where}: mcq "answer" must be an integer index`);
      } else if (options !== null && (answer < 0 || answer >= options.length)) {
        problems.push(
          `${where}: answer index ${answer} out of range for ${options.length} options`,
        );
      }
      if (
        id &&
        lesson &&
        prompt &&
        explanation &&
        options &&
        typeof answer === "number"
      ) {
        questions.push({ id, lesson, type, prompt, options, answer, explanation, tags });
      }
    } else if (type === "short") {
      const accept = requireStringArray(entry, "accept", where, problems);
      if (id && lesson && prompt && explanation && accept) {
        questions.push({ id, lesson, type, prompt, accept, explanation, tags });
      }
    } else {
      problems.push(`${where}: unknown question type "${String(type)}" (mcq | short)`);
    }
  });
  return questions;
}

/* ---------------- question templates (D-030) ----------------

   One authored entry with a `vars` block expands into one question per
   combination of those values. `derive` holds formulas evaluated per
   combination, and {{name}} placeholders in the prompt, options, explanation
   and accept list are replaced with the resulting numbers.

   The point is that the arithmetic is COMPUTED, never transcribed: the author
   writes the formula once, and twelve variants cannot disagree with it. That
   is what makes growing the bank honest rather than a fabrication risk.

     - id: m1/q-020
       lesson: m1/03-three-budgets
       type: mcq
       vars:
         latency_ns: [80, 100, 120, 150]
         clock_ghz: [2.4, 3.0, 3.6]
       derive:
         cycles: round(latency_ns * clock_ghz)
         divided_instead: round(latency_ns / clock_ghz)
       prompt: "A {{latency_ns}} ns DRAM access on a {{clock_ghz}} GHz core…"
       options: ["{{cycles}} cycles", "{{divided_instead}} cycles", …]
       answer: 0
       explanation: "{{latency_ns}} ns × {{clock_ghz}} GHz = {{cycles}} cycles…"
*/

/** A template with more variants than this is almost certainly a runaway cross
    product rather than an intention — 60 phrasings of one idea already exceeds
    what any single lesson can justify. */
const MAX_VARIANTS_PER_TEMPLATE = 60;

function expandTemplate(
  entry: Record<string, unknown>,
  where: string,
  problems: string[],
): Question[] {
  const id = requireString(entry, "id", where, problems);
  const lesson = requireString(entry, "lesson", where, problems);
  const promptTemplate = requireString(entry, "prompt", where, problems);
  const explanationTemplate = requireString(entry, "explanation", where, problems);
  const tags = optionalStringArray(entry, "tags", where, problems) ?? [];
  const type = entry["type"];

  const vars = readVarTable(entry["vars"], where, problems);
  const derive = readDeriveTable(entry["derive"], where, problems);
  if (vars === null || derive === null) return [];
  for (const name of Object.keys(derive)) {
    if (name in vars) {
      problems.push(`${where}: "${name}" is both a var and a derive — pick one`);
      return [];
    }
  }

  const combinations = cartesianProduct(vars);
  if (combinations.length > MAX_VARIANTS_PER_TEMPLATE) {
    problems.push(
      `${where}: template expands to ${combinations.length} variants, over the ` +
        `limit of ${MAX_VARIANTS_PER_TEMPLATE} — narrow one of the var lists`,
    );
    return [];
  }
  if (id === null || lesson === null || promptTemplate === null) return [];
  if (explanationTemplate === null) return [];

  const optionTemplates =
    type === "mcq" ? requireStringArray(entry, "options", where, problems) : null;
  const acceptTemplates =
    type === "short" ? requireStringArray(entry, "accept", where, problems) : null;
  const answer = entry["answer"];

  if (type === "mcq") {
    if (optionTemplates === null) return [];
    if (optionTemplates.length < 2 || optionTemplates.length > 6) {
      problems.push(`${where}: mcq needs 2–6 options, got ${optionTemplates.length}`);
      return [];
    }
    if (typeof answer !== "number" || !Number.isInteger(answer)) {
      problems.push(`${where}: mcq "answer" must be an integer index`);
      return [];
    }
    if (answer < 0 || answer >= optionTemplates.length) {
      problems.push(
        `${where}: answer index ${answer} out of range for ` +
          `${optionTemplates.length} options`,
      );
      return [];
    }
  } else if (type === "short") {
    if (acceptTemplates === null) return [];
  } else {
    problems.push(`${where}: unknown question type "${String(type)}" (mcq | short)`);
    return [];
  }

  const out: Question[] = [];
  combinations.forEach((binding, variantIndex) => {
    const values: Record<string, number> = { ...binding };
    // Derives are evaluated in author order, so a later formula may build on an
    // earlier one — which is how a multi-step derivation stays readable.
    for (const [name, formula] of Object.entries(derive)) {
      try {
        values[name] = evaluateExpression(formula, values);
      } catch (e) {
        problems.push(`${where}: derive "${name}" — ${(e as Error).message}`);
        return;
      }
    }

    const variantId = `${id}-${variantSuffix(binding)}`;
    const substituteHere = (text: string, field: string): string | null => {
      try {
        return substitutePlaceholders(text, values);
      } catch (e) {
        problems.push(`${where} (${variantId}) ${field}: ${(e as Error).message}`);
        return null;
      }
    };

    const prompt = substituteHere(promptTemplate, "prompt");
    const explanation = substituteHere(explanationTemplate, "explanation");
    if (prompt === null || explanation === null) return;

    if (type === "mcq") {
      const options: string[] = [];
      for (const template of optionTemplates!) {
        const option = substituteHere(template, "option");
        if (option === null) return;
        options.push(option);
      }
      // Rotate so the correct answer is not at the same index in every variant
      // — otherwise twelve variants of one template teach "it's always B".
      const rotation = variantIndex % options.length;
      out.push({
        id: variantId,
        lesson,
        type: "mcq",
        prompt,
        options: rotateBy(options, rotation),
        answer: ((answer as number) + rotation) % options.length,
        explanation,
        tags,
      });
    } else {
      const accept: string[] = [];
      for (const template of acceptTemplates!) {
        const value = substituteHere(template, "accept");
        if (value === null) return;
        accept.push(value);
      }
      out.push({
        id: variantId,
        lesson,
        type: "short",
        prompt,
        accept,
        explanation,
        tags,
      });
    }
  });
  return out;
}

/** `vars` must map each name to a non-empty list of numbers. */
function readVarTable(
  raw: unknown,
  where: string,
  problems: string[],
): Record<string, number[]> | null {
  if (!isRecord(raw)) {
    problems.push(`${where}: "vars" must be a mapping of name → list of numbers`);
    return null;
  }
  const table: Record<string, number[]> = {};
  for (const [name, values] of Object.entries(raw)) {
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some((v) => typeof v !== "number" || !Number.isFinite(v))
    ) {
      problems.push(`${where}: var "${name}" must be a non-empty list of numbers`);
      return null;
    }
    if (new Set(values).size !== values.length) {
      // A duplicated value would silently produce two identical variants that
      // collide on the same generated id.
      problems.push(`${where}: var "${name}" contains duplicate values`);
      return null;
    }
    table[name] = values as number[];
  }
  if (Object.keys(table).length === 0) {
    problems.push(`${where}: "vars" is empty — a template needs something to vary`);
    return null;
  }
  return table;
}

/** `derive` (optional) maps each name to a formula string. */
function readDeriveTable(
  raw: unknown,
  where: string,
  problems: string[],
): Record<string, string> | null {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    problems.push(`${where}: "derive" must be a mapping of name → formula`);
    return null;
  }
  const table: Record<string, string> = {};
  for (const [name, formula] of Object.entries(raw)) {
    if (typeof formula !== "string" || formula.trim() === "") {
      problems.push(`${where}: derive "${name}" must be a non-empty formula string`);
      return null;
    }
    table[name] = formula;
  }
  return table;
}

/** Every combination of the var lists, in declaration order. */
function cartesianProduct(vars: Record<string, number[]>): Record<string, number>[] {
  let combinations: Record<string, number>[] = [{}];
  for (const [name, values] of Object.entries(vars)) {
    const next: Record<string, number>[] = [];
    for (const combination of combinations) {
      for (const value of values) next.push({ ...combination, [name]: value });
    }
    combinations = next;
  }
  return combinations;
}

/**
 * A short, stable id suffix derived from the variant's VALUES rather than its
 * position. Position would be a bug: adding one more clock speed later would
 * renumber every variant after it, silently pointing Christopher's stored
 * attempt history at different questions. Values never move.
 */
function variantSuffix(binding: Record<string, number>): string {
  const canonical = Object.keys(binding)
    .sort()
    .map((name) => `${name}=${binding[name]}`)
    .join(";");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 6);
}

/** Replace every {{name}} with its value; {{name:,}} adds thousands separators. */
function substitutePlaceholders(
  text: string,
  values: Readonly<Record<string, number>>,
): string {
  return text.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::\s*(,))?\s*\}\}/g,
    (_match, name: string, grouped: string | undefined) => {
      if (!(name in values)) {
        const known = Object.keys(values).sort().join(", ");
        throw new Error(`unknown placeholder "{{${name}}}" (available: ${known})`);
      }
      return formatNumber(values[name]!, grouped === ",");
    },
  );
}

/**
 * Numbers as a reader expects them. toFixed(6) then back through Number strips
 * binary floating-point noise (0.30000000000000004 → 0.3) without inventing
 * precision; authors control real rounding with round() in the formula.
 */
function formatNumber(value: number, grouped: boolean): string {
  const clean = Number(value.toFixed(6));
  return grouped ? clean.toLocaleString("en-US") : String(clean);
}

/** items[j] moves to index (j + by) % length. */
function rotateBy<T>(items: T[], by: number): T[] {
  const out = new Array<T>(items.length);
  items.forEach((item, j) => {
    out[(j + by) % items.length] = item;
  });
  return out;
}

/* ---------------- cross-module checks ---------------- */

function validateCrossReferences(modules: Module[], problems: string[]): void {
  const moduleIds = new Set(modules.map((m) => m.id));

  const seenLessonIds = new Map<string, string>(); // lesson id → module id
  const seenQuestionIds = new Map<string, string>();
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      const prev = seenLessonIds.get(lesson.id);
      if (prev) {
        problems.push(`lesson id "${lesson.id}" duplicated (modules ${prev}, ${mod.id})`);
      }
      seenLessonIds.set(lesson.id, mod.id);
    }
  }
  for (const mod of modules) {
    const localLessons = new Set(mod.lessons.map((l) => l.id));
    for (const q of mod.questions) {
      const prev = seenQuestionIds.get(q.id);
      if (prev) {
        problems.push(`question id "${q.id}" duplicated (modules ${prev}, ${mod.id})`);
      }
      seenQuestionIds.set(q.id, mod.id);
      if (!localLessons.has(q.lesson)) {
        problems.push(
          `module ${mod.id}: question "${q.id}" references unknown lesson "${q.lesson}"`,
        );
      }
      // Two identical options make the question unanswerable — one of the two
      // is "correct" and the other scores wrong for identical text. Hand-typed
      // banks rarely hit this, but a template whose distractor formula happens
      // to equal the answer for one combination of values does, and only for
      // SOME variants (m1/q-028 shipped exactly that until the build caught
      // it). This is why the check lives here rather than in review.
      if (q.type === "mcq") {
        const duplicates = q.options.filter((opt, i) => q.options.indexOf(opt) !== i);
        if (duplicates.length > 0) {
          problems.push(
            `module ${mod.id}: question "${q.id}" has duplicate options ` +
              `(${[...new Set(duplicates)].map((d) => `"${d}"`).join(", ")}) — ` +
              `a distractor collides with another option`,
          );
        }
      }
    }
    for (const p of mod.prereqs) {
      if (!moduleIds.has(p)) {
        problems.push(`module ${mod.id}: unknown prereq "${p}"`);
      }
    }
  }

  detectPrereqCycles(modules, problems);
}

function detectPrereqCycles(modules: Module[], problems: string[]): void {
  const prereqsOf = new Map(modules.map((m) => [m.id, m.prereqs]));
  const done = new Set<string>();
  const inStack = new Set<string>();

  function visit(id: string, path: string[]): void {
    if (done.has(id)) return;
    if (inStack.has(id)) {
      problems.push(`prereq cycle: ${[...path, id].join(" → ")}`);
      return;
    }
    inStack.add(id);
    for (const p of prereqsOf.get(id) ?? []) visit(p, [...path, id]);
    inStack.delete(id);
    done.add(id);
  }
  for (const mod of modules) visit(mod.id, []);
}

/** Prereqs-first order, ties broken alphabetically (stable, deterministic). */
function topologicalSort(modules: Module[]): Module[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const out: Module[] = [];
  const done = new Set<string>();
  function place(mod: Module): void {
    if (done.has(mod.id)) return;
    done.add(mod.id); // cycles were already reported; this guards the walk
    for (const p of [...mod.prereqs].sort()) {
      const dep = byId.get(p);
      if (dep) place(dep);
    }
    out.push(mod);
  }
  for (const mod of [...modules].sort((a, b) => a.id.localeCompare(b.id))) place(mod);
  return out;
}

/* ---------------- field helpers ----------------
   Each pushes a problem naming the file and field, and returns null on
   failure, so callers can keep collecting further problems. */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseYamlFile(file: string, problems: string[]): unknown | null {
  try {
    return parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${file}: invalid YAML — ${(e as Error).message}`);
    return null;
  }
}

function requireString(
  obj: Record<string, unknown>,
  field: string,
  where: string,
  problems: string[],
): string | null {
  const v = obj[field];
  if (typeof v !== "string" || v.trim() === "") {
    problems.push(`${where}: missing or empty "${field}"`);
    return null;
  }
  return v;
}

function requireStringArray(
  obj: Record<string, unknown>,
  field: string,
  where: string,
  problems: string[],
): string[] | null {
  const v = obj[field];
  if (
    !Array.isArray(v) ||
    v.length === 0 ||
    v.some((x) => typeof x !== "string" || x.trim() === "")
  ) {
    problems.push(`${where}: "${field}" must be a non-empty list of strings`);
    return null;
  }
  return v;
}

function optionalStringArray(
  obj: Record<string, unknown>,
  field: string,
  where: string,
  problems: string[],
): string[] | null {
  if (obj[field] === undefined) return [];
  return requireStringArray(obj, field, where, problems);
}
