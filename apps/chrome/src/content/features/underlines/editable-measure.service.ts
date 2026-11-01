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
  return {
    rangeRects(start, end) {
      const range = editableRange(field, start, end);
      if (!range) return [];
      // Ranges crossing elements also report empty boxes for them; keep the text lines only.
      const rects = [...range.getClientRects()].map(toRect).filter((r) => r.width > 0);
      return clipRects(rects, box);
    },
    remove() {},
  };
};
