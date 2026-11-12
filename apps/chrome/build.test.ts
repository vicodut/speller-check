import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./build";

describe("build", () => {
  let outdir = "";
  let css = "";

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "chrome-build-"));
    await build(outdir);
    css = await Bun.file(join(outdir, "options.css")).text();
  }, 60_000);

  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  test("writes everything the manifest points at", async () => {
    const files = ["manifest.json", "background.js", "content.js", "options.html", "options.js"];
    for (const file of [...files, "options.css"]) {
      expect(await Bun.file(join(outdir, file)).exists()).toBe(true);
    }
  });

  test("the options style carries the shared theme and the component classes", () => {
    expect(css).toContain("--gc-primary:");
    expect(css).toContain("--color-card:");
    expect(css).toContain("prefers-color-scheme:dark");
    expect(css).toContain(".rounded-xl");
  });

  test("the options style is self-contained: no @import, no remote URL", () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toContain("@import");
    expect(rules).not.toMatch(/https?:\/\//);
  });
});
