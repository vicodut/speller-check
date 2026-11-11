import { describe, expect, test } from "bun:test";
import { DARK, LIGHT, PALETTE_TOKENS } from "./palette";
import { shadowThemeCss } from "./shadow-css.util";

const css = shadowThemeCss(LIGHT, DARK);

describe("shadowThemeCss", () => {
  test("puts every token on :host, so it reaches inside the shadow root", () => {
    const host = css.slice(css.indexOf(":host {"), css.indexOf("}"));
    for (const token of PALETTE_TOKENS) expect(host).toContain(`--gc-${token}: ${LIGHT[token]};`);
  });

  test("the dark palette overrides every token under prefers-color-scheme: dark", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark) {"));
    for (const token of PALETTE_TOKENS) expect(dark).toContain(`--gc-${token}: ${DARK[token]};`);
  });

  test("no Tailwind directives and no :root (page CSS stays untouched)", () => {
    expect(css).not.toContain("@theme");
    expect(css).not.toContain("@source");
    expect(css).not.toContain(":root");
  });
});
