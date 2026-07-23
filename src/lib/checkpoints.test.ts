import { describe, expect, it } from "vitest";
import {
  checkpointById,
  checkpointPairs,
  checkpointQuestions,
  CHECKPOINT_SIZE,
  type Checkpoint,
} from "./checkpoints";
import type { Module, Question } from "./curriculum";

/** A module with `n` throwaway questions, enough for the sampling tests. */
function moduleWith(id: string, n: number): Module {
  const questions: Question[] = Array.from({ length: n }, (_, i) => ({
    id: `${id}/q-${i}`,
    lesson: `${id}/l1`,
    type: "mcq",
    prompt: `q${i}`,
    options: ["a", "b"],
    answer: 0,
    explanation: "because",
    tags: [],
  })) as Question[];
  return {
    id,
    title: `${id} title`,
    prereqs: [],
    lessons: [],
    questions,
  } as unknown as Module;
}

/** Deterministic rng cycling through fixed values, for reproducible shuffles. */
function seededRng(seed = 1): () => number {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

describe("checkpoint pairing", () => {
  it("pairs consecutive modules in order", () => {
    const mods = ["m1", "m2", "m3", "m4"].map((id) => moduleWith(id, 5));
    const pairs = checkpointPairs(mods);
    expect(pairs.map((p) => [p.first.id, p.second.id])).toEqual([
      ["m1", "m2"],
      ["m3", "m4"],
    ]);
    expect(pairs.map((p) => p.number)).toEqual([1, 2]);
  });

  it("leaves a trailing odd module without a checkpoint", () => {
    const mods = ["m1", "m2", "m3"].map((id) => moduleWith(id, 5));
    const pairs = checkpointPairs(mods);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.second.id).toBe("m2");
  });

  it("finds a checkpoint by its first module id, and rejects a non-first id", () => {
    const mods = ["m1", "m2", "m3", "m4"].map((id) => moduleWith(id, 5));
    expect(checkpointById(mods, "m3")?.second.id).toBe("m4");
    // m2 is the SECOND of a pair, not the first, so it names no checkpoint.
    expect(checkpointById(mods, "m2")).toBeNull();
  });
});

describe("checkpoint question sampling", () => {
  const pairFrom = (a: Module, b: Module): Checkpoint => ({
    id: a.id,
    first: a,
    second: b,
    number: 1,
  });

  it("draws CHECKPOINT_SIZE questions split evenly when both banks are large", () => {
    const cp = pairFrom(moduleWith("m1", 20), moduleWith("m2", 20));
    const sample = checkpointQuestions(cp, CHECKPOINT_SIZE, seededRng());
    expect(sample).toHaveLength(12);
    const fromA = sample.filter((q) => q.id.startsWith("m1/")).length;
    const fromB = sample.filter((q) => q.id.startsWith("m2/")).length;
    expect(fromA).toBe(6);
    expect(fromB).toBe(6);
  });

  it("takes more from the richer bank when one module is short", () => {
    const cp = pairFrom(moduleWith("m1", 3), moduleWith("m2", 20));
    const sample = checkpointQuestions(cp, 12, seededRng());
    expect(sample).toHaveLength(12);
    expect(sample.filter((q) => q.id.startsWith("m1/")).length).toBe(3);
    expect(sample.filter((q) => q.id.startsWith("m2/")).length).toBe(9);
  });

  it("never returns more than the two banks hold", () => {
    const cp = pairFrom(moduleWith("m1", 5), moduleWith("m2", 4));
    const sample = checkpointQuestions(cp, 12, seededRng());
    expect(sample).toHaveLength(9);
  });

  it("draws no duplicate questions", () => {
    const cp = pairFrom(moduleWith("m1", 20), moduleWith("m2", 20));
    const sample = checkpointQuestions(cp, 12, seededRng());
    expect(new Set(sample.map((q) => q.id)).size).toBe(sample.length);
  });

  it("alternates between the two modules rather than clumping", () => {
    const cp = pairFrom(moduleWith("m1", 20), moduleWith("m2", 20));
    const sample = checkpointQuestions(cp, 12, seededRng());
    // With a balanced split and interleaving, no three consecutive questions
    // should come from the same module.
    for (let i = 0; i + 2 < sample.length; i++) {
      const trio = [sample[i]!, sample[i + 1]!, sample[i + 2]!];
      const allA = trio.every((q) => q.id.startsWith("m1/"));
      const allB = trio.every((q) => q.id.startsWith("m2/"));
      expect(allA || allB).toBe(false);
    }
  });
});
