// Compiled-curriculum types: the shape of curriculum.json as the app consumes
// it. Depends on: nothing. Depended on by: the content compiler (tools/) and,
// soon, the lesson renderer and quiz engine.
//
// These types describe VALIDATED output — the content compiler is the only
// thing allowed to produce this shape, and it guarantees every invariant the
// comments below mention (unique ids, resolved references, in-range answers).
// Authoring-side shapes (raw YAML/Markdown) live in docs/DATA_MODEL.md and are
// checked by the compiler, not typed here: they're untrusted input by design.

export interface McqQuestion {
  id: string; // globally unique, stable forever (progress history refs it)
  lesson: string; // resolves to a Lesson.id in the same module
  type: "mcq";
  prompt: string;
  options: string[]; // 2–6 entries
  answer: number; // index into options, validated in range
  explanation: string; // shown after answering — always present
  tags: string[];
}

export interface ShortQuestion {
  id: string;
  lesson: string;
  type: "short";
  prompt: string;
  accept: string[]; // non-empty; graded via lib/short-answer.ts
  explanation: string;
  tags: string[];
}

export type Question = McqQuestion | ShortQuestion;

export interface Lesson {
  id: string; // globally unique, stable forever
  title: string;
  objectives: string[]; // what you can DO after, not what the text covers
  sources: string[]; // non-empty — enforced against RISKS.md R4
  html: string; // Markdown already rendered at build time (D-005)
}

export interface Module {
  id: string; // matches its content/modules/<id>/ folder name
  title: string;
  prereqs: string[]; // module ids; acyclic, validated
  lessons: Lesson[]; // in the order module.yaml lists them
  questions: Question[];
}

export interface Curriculum {
  contentVersion: string; // hash of compiled content; cache-busting for the SW
  modules: Module[]; // topologically sorted by prereqs
}
