import { type Palette, paletteVars } from "./palette";

/**
 * The palette as variables on :host, for UI injected into a Shadow DOM: same names as the pages
 * (`--gc-primary`…), no Tailwind, nothing that reaches the page's own styles.
 */
export const shadowThemeCss = (light: Palette, dark: Palette): string => `\
:host {
  color-scheme: light dark;
${paletteVars(light, "  ")}
}
@media (prefers-color-scheme: dark) {
  :host {
${paletteVars(dark, "    ")}
  }
}
`;
