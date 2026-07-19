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
