import { editableRange } from "../../shared/field-text";
import type { FieldMeasurer } from "./mirror-measure.service";
import { visibleBox } from "./mirror-measure.service";
import { clipRects, type Rect } from "./rect.util";

const toRect = (r: DOMRect): Rect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

/** Measures text ranges of a contenteditable field straight from the DOM, no mirror needed. */
export const createEditableMeasurer = (field: HTMLElement): FieldMeasurer => {
  const box = visibleBox(field);
  const rawRects = (start: number, end: number): Rect[] => {
    const range = editableRange(field, start, end);
    if (!range) return [];
    // Ranges crossing elements also report empty boxes for them; keep the text lines only.
    return [...range.getClientRects()].map(toRect).filter((r) => r.width > 0);
  };
  return {
    rangeRects: (start, end) => clipRects(rawRects(start, end), box),
    firstRect: (start, end) => rawRects(start, end)[0],
    remove() {},
  };
};
