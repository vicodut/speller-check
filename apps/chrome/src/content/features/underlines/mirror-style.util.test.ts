import { describe, expect, test } from "bun:test";
import { buildMirrorStyle, MIRRORED_PROPERTIES } from "./mirror-style.util";

const computed: Record<string, string> = {
  "font-family": "Inter",
  "font-size": "14px",
  "line-height": "20px",
  "padding-left": "8px",
  "overflow-wrap": "anywhere",
};
const read = (p: string): string => computed[p] ?? "";
const metrics = { width: 300, height: 80, contentHeight: 64 };

describe("MIRRORED_PROPERTIES", () => {
  test("covers the properties that change text layout", () => {
    for (const p of ["font-family", "letter-spacing", "tab-size", "direction", "text-align"]) {
      expect(MIRRORED_PROPERTIES).toContain(p as (typeof MIRRORED_PROPERTIES)[number]);
    }
  });
});

describe("buildMirrorStyle", () => {
  test("copies the field's computed style", () => {
    const style = buildMirrorStyle(read, "textarea", metrics);
    expect(style["font-family"]).toBe("Inter");
    expect(style["padding-left"]).toBe("8px");
  });

  test("sizes the mirror like the field and keeps it invisible", () => {
    const style = buildMirrorStyle(read, "textarea", metrics);
    expect(style.width).toBe("300px");
    expect(style.height).toBe("80px");
    expect(style["box-sizing"]).toBe("border-box");
    expect(style.visibility).toBe("hidden");
    expect(style["pointer-events"]).toBe("none");
  });

  test("wraps like a textarea", () => {
    const style = buildMirrorStyle(read, "textarea", metrics);
    expect(style["white-space"]).toBe("pre-wrap");
    expect(style["overflow-wrap"]).toBe("anywhere");
    expect(style["line-height"]).toBe("20px");
  });

  test("keeps an input on one centred line", () => {
    const style = buildMirrorStyle(read, "input", metrics);
    expect(style["white-space"]).toBe("pre");
    expect(style["overflow-wrap"]).toBe("normal");
    expect(style["line-height"]).toBe("64px");
  });
});
