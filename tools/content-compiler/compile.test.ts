import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileContent, ContentError } from "./compile.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("compileContent on well-formed content", () => {
  const curriculum = compileContent(join(fixtures, "valid"));

  it("compiles modules, lessons, and questions with a content version", () => {
    expect(curriculum.modules).toHaveLength(1);
    expect(curriculum.modules[0]!.lessons).toHaveLength(1);
    expect(curriculum.modules[0]!.questions).toHaveLength(2);
    expect(curriculum.contentVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it("renders lesson Markdown to HTML at compile time", () => {
    expect(curriculum.modules[0]!.lessons[0]!.html).toContain("<strong>fixture</strong>");
    expect(curriculum.modules[0]!.lessons[0]!.html).toContain("<li>one list item</li>");
  });
});

describe("compileContent on malformed content — fails loudly, not silently", () => {
  const compileBroken = () => compileContent(join(fixtures, "many-problems"));

  it("rejects malformed content instead of emitting partial output", () => {
    expect(compileBroken).toThrow(ContentError);
  });

  it("reports every problem in one pass, each naming the offending file", () => {
    let error: ContentError;
    try {
      compileBroken();
      expect.unreachable("compile should have thrown");
    } catch (e) {
      error = e as ContentError;
    }
    const all = error!.problems.join("\n");
    expect(all).toMatch(/01-no-sources\.md.*"sources"/);
    expect(all).toMatch(/lesson "02-missing-file" listed but .* does not exist/);
    expect(all).toMatch(/03-orphan\.md.*orphan lesson/);
    expect(all).toMatch(/answer index 5 out of range/);
    expect(all).toMatch(/"accept" must be a non-empty list/);
    expect(all).toMatch(/unknown lesson "fxb\/does-not-exist"/);
    expect(all).toMatch(/question id "fxb\/q-001" duplicated/);
    // Every problem line should carry a locatable context (file path or module id).
    for (const p of error!.problems) {
      expect(p).toMatch(/fx-broken|fxb\//);
    }
  });

  it("detects prereq cycles between modules", () => {
    expect(() => compileContent(join(fixtures, "prereq-cycle"))).toThrow(/prereq cycle/);
  });
});

describe("question templates (D-030)", () => {
  const bank = compileContent(join(fixtures, "templates")).modules[0]!.questions;

  it("expands one authored entry into a question per combination of its vars", () => {
    // 4 latencies × 3 clocks = 12, plus 2 cache-line variants, plus 1 ordinary
    // hand-written question that must survive alongside them.
    expect(bank).toHaveLength(15);
    expect(bank.filter((q) => q.id.startsWith("fxt/q-001-"))).toHaveLength(12);
    expect(bank.filter((q) => q.id.startsWith("fxt/q-002-"))).toHaveLength(2);
    expect(bank.filter((q) => q.id === "fxt/q-003")).toHaveLength(1);
  });

  it("computes the arithmetic instead of trusting an author to transcribe it", () => {
    const q = bank.find(
      (x) =>
        x.id.startsWith("fxt/q-001-") &&
        x.prompt.includes("100 ns") &&
        x.prompt.includes("3 GHz"),
    );
    expect(q).toBeDefined();
    expect(q!.type).toBe("mcq");
    // 100 ns × 3 GHz = 300 cycles, and the explanation shows that derivation.
    expect(q!.explanation).toContain("100 × 3 = 300 cycles");
    if (q!.type === "mcq") expect(q!.options[q!.answer]).toBe("300");
  });

  it("formats a grouped placeholder with thousands separators", () => {
    const q = bank.find(
      (x) =>
        x.id.startsWith("fxt/q-001-") &&
        x.prompt.includes("100 ns") &&
        x.prompt.includes("3 GHz"),
    )!;
    if (q.type === "mcq") expect(q.options).toContain("300,000");
  });

  it("substitutes into a short answer's accept list", () => {
    const q = bank.find(
      (x) => x.id.startsWith("fxt/q-002-") && x.prompt.includes("64-byte"),
    )!;
    expect(q.type).toBe("short");
    if (q.type === "short") expect(q.accept).toEqual(["16"]);
  });

  it("moves the correct answer around so variants don't all share one index", () => {
    const answers = new Set(
      bank
        .filter((q) => q.id.startsWith("fxt/q-001-") && q.type === "mcq")
        .map((q) => (q.type === "mcq" ? q.answer : -1)),
    );
    expect(answers.size).toBeGreaterThan(1);
  });

  it("derives variant ids from values, so adding a case never renames the others", () => {
    // Ids are referenced by stored progress: position-based suffixes would
    // silently repoint his history when a var list grows.
    const ids = bank.filter((q) => q.id.startsWith("fxt/q-001-")).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^fxt\/q-001-[0-9a-f]{6}$/);
  });
});

describe("malformed question templates — every problem reported at once", () => {
  it("names each broken template rather than failing on the first", () => {
    let error: ContentError;
    try {
      compileContent(join(fixtures, "template-problems"));
      expect.unreachable("compile should have thrown");
    } catch (e) {
      error = e as ContentError;
    }
    const all = error!.problems.join("\n");
    expect(all).toMatch(/unknown placeholder "\{\{nonexistent\}\}"/);
    expect(all).toMatch(/unknown variable "missing_var"/);
    expect(all).toMatch(/expands to 100 variants, over the limit of 60/);
    expect(all).toMatch(/var "a" contains duplicate values/);
    expect(all).toMatch(/"a" is both a var and a derive/);
    expect(all).toMatch(/answer index 7 out of range/);
  });

  it("catches a distractor that collides with the answer for only some variants", () => {
    // The real bug this check was written for: a * 2 equals a + 4 when a is 4,
    // so one variant of the template is unanswerable while the others are fine.
    let error: ContentError;
    try {
      compileContent(join(fixtures, "template-problems"));
      expect.unreachable("compile should have thrown");
    } catch (e) {
      error = e as ContentError;
    }
    const collisions = error!.problems.filter((p) => p.includes("duplicate options"));
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatch(/fxb\/q-007-[0-9a-f]{6}/);
  });
});
