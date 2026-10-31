export type FieldKind = "textarea" | "input";

/** Computed properties copied from the field so the mirror lays text out the same way. */
export const MIRRORED_PROPERTIES = [
  "direction",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "font-size-adjust",
  "font-feature-settings",
  "font-variation-settings",
  "font-kerning",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-transform",
  "text-indent",
  "text-align",
  "text-rendering",
  "tab-size",
  "word-break",
  "overflow-wrap",
  "hyphens",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
] as const;

/** Field geometry in CSS pixels. `width`/`height` are the border box minus any scrollbar. */
export type MirrorMetrics = { width: number; height: number; contentHeight: number };

const FIXED: Record<string, string> = {
  position: "fixed",
  left: "0px",
  top: "0px",
  margin: "0px",
  overflow: "hidden",
  visibility: "hidden",
  "pointer-events": "none",
  "box-sizing": "border-box",
  "border-style": "solid",
  "border-color": "transparent",
};

const byKind = (kind: FieldKind, read: (p: string) => string, m: MirrorMetrics) =>
  kind === "textarea"
    ? { "white-space": "pre-wrap", "overflow-wrap": read("overflow-wrap") || "break-word" }
    : // An input shows one line, vertically centred in its content box.
      { "white-space": "pre", "overflow-wrap": "normal", "line-height": `${m.contentHeight}px` };

/** Inline style for the mirror div of a field, from its computed style and geometry. */
export const buildMirrorStyle = (
  read: (property: string) => string,
  kind: FieldKind,
  metrics: MirrorMetrics,
): Record<string, string> => {
  const copied = Object.fromEntries(MIRRORED_PROPERTIES.map((p) => [p, read(p)]));
  return {
    ...copied,
    ...FIXED,
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    ...byKind(kind, read, metrics),
  };
};
