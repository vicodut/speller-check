// The one colour palette for every web surface: the settings page, the extension's options page
// and the UI the extension injects into pages. `bun run generate` turns it into CSS.

export const PALETTE_TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "muted-foreground",
  "border",
  "primary",
  "primary-foreground",
  "destructive",
  "success",
  "success-background",
  "warning",
  "warning-background",
] as const;

export type PaletteToken = (typeof PALETTE_TOKENS)[number];
export type Palette = Readonly<Record<PaletteToken, string>>;

export const LIGHT: Palette = {
  background: "#fcfcfd",
  foreground: "#1c2024",
  card: "#ffffff",
  muted: "#f0f0f3",
  "muted-foreground": "#60646c",
  border: "#e0e1e6",
  primary: "#3e63dd",
  // Text on a primary or destructive fill.
  "primary-foreground": "#ffffff",
  destructive: "#ce2c31",
  success: "#2b9a66",
  "success-background": "#e6f6eb",
  warning: "#ab6400",
  "warning-background": "#fff7c2",
};

export const DARK: Palette = {
  background: "#111113",
  foreground: "#edeef0",
  card: "#18191b",
  muted: "#212225",
  "muted-foreground": "#b0b4ba",
  border: "#2e3135",
  primary: "#9eb1ff",
  "primary-foreground": "#111113",
  destructive: "#ff9592",
  success: "#3dd68c",
  "success-background": "#132d21",
  warning: "#ffca16",
  "warning-background": "#302008",
};

/** `--gc-token: value;` lines for one palette, indented for a rule body. */
export const paletteVars = (palette: Palette, indent: string): string =>
  PALETTE_TOKENS.map((token) => `${indent}--gc-${token}: ${palette[token]};`).join("\n");
