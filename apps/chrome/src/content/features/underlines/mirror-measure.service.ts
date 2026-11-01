import type { TextControl, WatchedField } from "../../shared/issue-view";
import { buildMirrorStyle, type FieldKind } from "./mirror-style.util";
import { clipRects, type Rect } from "./rect.util";
import { splitAtRange } from "./text-split.util";

/** Measures on-screen rects of text ranges in one field, through a hidden mirror div. */
export type FieldMeasurer = {
  /** Visible line rects of [start, end), in viewport coordinates, clipped to the field. */
  rangeRects(start: number, end: number): Rect[];
  remove(): void;
};

const px = (style: CSSStyleDeclaration, property: string): number =>
  Number.parseFloat(style.getPropertyValue(property)) || 0;

const toRect = (r: DOMRect): Rect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

/** The field's padding box (inside its borders, without scrollbars), in viewport coordinates. */
export const visibleBox = (field: WatchedField): Rect => {
  const r = field.getBoundingClientRect();
  return {
    left: r.left + field.clientLeft,
    top: r.top + field.clientTop,
    width: field.clientWidth,
    height: field.clientHeight,
  };
};

const createMirrorDiv = (field: TextControl, parent: Node): HTMLDivElement => {
  const computed = getComputedStyle(field);
  const kind: FieldKind = field instanceof HTMLTextAreaElement ? "textarea" : "input";
  const borderX = px(computed, "border-left-width") + px(computed, "border-right-width");
  const borderY = px(computed, "border-top-width") + px(computed, "border-bottom-width");
  const padY = px(computed, "padding-top") + px(computed, "padding-bottom");
  const style = buildMirrorStyle((p) => computed.getPropertyValue(p), kind, {
    width: field.clientWidth + borderX,
    height: field.clientHeight + borderY,
    contentHeight: Math.max(0, field.clientHeight - padY),
  });
  const div = document.createElement("div");
  for (const [property, value] of Object.entries(style)) div.style.setProperty(property, value);
  parent.appendChild(div);
  return div;
};

/** Measures a textarea/input for its current style and size; `remove` it after use. */
export const createMirrorMeasurer = (field: TextControl, parent: Node): FieldMeasurer => {
  const mirror = createMirrorDiv(field, parent);
  const box = visibleBox(field);
  return {
    rangeRects(start, end) {
      const parts = splitAtRange(field.value, start, end);
      if (parts.range === "") return [];
      const span = document.createElement("span");
      span.textContent = parts.range;
      mirror.replaceChildren(parts.before, span, parts.after);
      const origin = mirror.getBoundingClientRect();
      const dx = box.left - field.clientLeft - origin.left - field.scrollLeft;
      const dy = box.top - field.clientTop - origin.top - field.scrollTop;
      const rects = [...span.getClientRects()].map((r) => {
        const rect = toRect(r);
        return { ...rect, left: rect.left + dx, top: rect.top + dy };
      });
      return clipRects(rects, box);
    },
    remove() {
      mirror.remove();
    },
  };
};
