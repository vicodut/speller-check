import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "./generate";

describe("generate", () => {
  let outdir = "";

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), "ui-generate-"));
    await generate(outdir);
  });

  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  test("writes the Tailwind theme", async () => {
    const css = await Bun.file(join(outdir, "theme.generated.css")).text();
    expect(css).toContain("@theme static inline");
  });

  test("writes the Shadow DOM theme as an importable string", async () => {
    const mod = await import(join(outdir, "shadow-theme.generated.ts"));
    expect(mod.SHADOW_THEME_CSS).toContain(":host {");
  });
});
