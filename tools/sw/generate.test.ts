import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateServiceWorker } from "./generate.ts";

let dirs: string[] = [];
const fakeDist = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), "metal-sw-test-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, ...rel.split("/"));
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
};

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe("generateServiceWorker", () => {
  it("precaches the base URL plus every dist file, excluding index.html and stale sw.js", () => {
    const dist = fakeDist({
      "index.html": "<html></html>",
      "assets/app.js": "js",
      "curriculum.json": "{}",
      "sw.js": "old worker output",
    });
    const { urls, source } = generateServiceWorker(dist, "/bare-metal/");
    expect(urls).toEqual([
      "/bare-metal/",
      "/bare-metal/assets/app.js",
      "/bare-metal/curriculum.json",
    ]);
    expect(source).toContain('"/bare-metal/assets/app.js"');
    expect(source).not.toContain("old worker output");
  });

  it("changes the cache version when any file's content changes, and only then", () => {
    const a = generateServiceWorker(
      fakeDist({ "index.html": "x", "app.js": "one" }),
      "/bare-metal/",
    );
    const same = generateServiceWorker(
      fakeDist({ "index.html": "x", "app.js": "one" }),
      "/bare-metal/",
    );
    const changed = generateServiceWorker(
      fakeDist({ "index.html": "x", "app.js": "two" }),
      "/bare-metal/",
    );
    expect(same.version).toBe(a.version);
    expect(changed.version).not.toBe(a.version);
  });

  it("refuses to run against a dist folder with no index.html", () => {
    const dist = fakeDist({ "assets/app.js": "js" });
    expect(() => generateServiceWorker(dist, "/bare-metal/")).toThrow(/no index\.html/);
  });
});
