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
import type { Curriculum, Lesson, Module, Question } from "../../src/lib/curriculum.ts";

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

  if (problems.length > 0) throw new ContentError(problems);

  const sorted = topologicalSort(modules);
  // Hash of everything the app will see: any content change produces a new
  // version, which is how the service worker will know to refetch (D-008).
  const contentVersion = createHash("sha256")
    .update(JSON.stringify(sorted))
    .digest("hex")
    .slice(0, 16);
  return { contentVersion, modules: sorted };
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
  return { id, title, objectives, sources, html: marked.parse(body) as string };
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
