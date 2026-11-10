import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "./build";

describe("build", () => {
  let outdir = "";
  let css = "";

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "settings-web-build-"));
    await build(outdir);
    css = await Bun.file(join(outdir, "app.css")).text();
  }, 60_000);

  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  test("writes the page, its script and its style", async () => {
    for (const file of ["index.html", "app.js", "app.css"]) {
      expect(await Bun.file(join(outdir, file)).exists()).toBe(true);
    }
  });

  test("the style defines the theme tokens, mapped onto the palette", () => {
    for (const token of [
      "--color-background",
      "--color-card",
      "--color-card-foreground",
      "--color-muted",
      "--color-foreground",
      "--color-muted-foreground",
      "--color-border",
      "--color-input",
      "--color-ring",
      "--color-primary",
      "--color-destructive",
      "--color-success",
      "--color-success-background",
      "--color-warning",
      "--color-warning-background",
    ]) {
      expect(css).toContain(`${token}:`);
    }
    expect(css).toContain("--bg");
    expect(css).toContain("prefers-color-scheme:dark");
  });

  test("the style is self-contained: no @import, no remote URL (the CSP is style-src 'self')", () => {
    // The licence banner names tailwindcss.com in a comment; only rules can fetch anything.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toContain("@import");
    expect(rules).not.toMatch(/https?:\/\//);
  });
});
