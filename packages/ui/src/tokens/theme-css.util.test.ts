import { describe, expect, test } from "bun:test";
import type { Palette } from "./palette";
import { DARK, LIGHT, PALETTE_TOKENS } from "./palette";
import { themeCss } from "./theme-css.util";

const css = themeCss(LIGHT, DARK);

const block = (text: string, opener: string): string => {
  const start = text.indexOf(opener);
  if (start < 0) throw new Error(`no block ${opener}`);
  return text.slice(start, text.indexOf("}", start));
};

describe("themeCss", () => {
  test("says it is generated and must not be edited", () => {
    expect(css.startsWith("/* Generated")).toBe(true);
  });

  test("tells Tailwind to scan the shared components", () => {
    expect(css).toContain('@source "./components";');
  });

  test("dark: follows the system", () => {
    expect(css).toContain("@custom-variant dark (@media (prefers-color-scheme: dark));");
  });

  test("every palette token is a --gc- variable on :root, light first", () => {
    const root = block(css, ":root {");
    for (const token of PALETTE_TOKENS) expect(root).toContain(`--gc-${token}: ${LIGHT[token]};`);
  });

  test("the dark palette overrides every token under prefers-color-scheme: dark", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark) {"));
    const root = block(dark, ":root {");
    for (const token of PALETTE_TOKENS) expect(root).toContain(`--gc-${token}: ${DARK[token]};`);
  });

  test("maps the shadcn colour tokens onto the variables", () => {
    const theme = block(css, "@theme static inline {");
    expect(theme).toContain("--color-background: var(--gc-background);");
    expect(theme).toContain("--color-card-foreground: var(--gc-foreground);");
    expect(theme).toContain("--color-input: var(--gc-border);");
    expect(theme).toContain("--color-ring: var(--gc-primary);");
    expect(theme).toContain("--color-warning-background: var(--gc-warning-background);");
  });

  test("uses the palette it is given", () => {
    const red = Object.fromEntries(PALETTE_TOKENS.map((t) => [t, "#f00"])) as Palette;
    expect(themeCss(red, DARK)).toContain("--gc-primary: #f00;");
  });
});
