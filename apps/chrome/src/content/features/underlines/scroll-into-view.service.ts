import { visibleBox } from "./mirror-measure.service";
import { offsetRect, type Rect } from "./rect.util";
import { scrollDelta } from "./scroll-delta.util";

/** Space kept around the target, so it isn't flush with the field's or the window's edge. */
const MARGIN = 8;

const canScroll = (el: Element): boolean =>
  el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;

/** The next element up, crossing shadow roots (a field may live inside a web component). */
const parentOf = (el: Element): Element | null => {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
};

/** Scrolls one box (an element, or the window) and returns `target` moved by what it really did. */
const scrollBox = (target: Rect, box: Rect, el: Element | null): Rect => {
  const delta = scrollDelta(target, box, MARGIN);
  if (delta.x === 0 && delta.y === 0) return target;
  const read = (): { x: number; y: number } =>
    el ? { x: el.scrollLeft, y: el.scrollTop } : { x: scrollX, y: scrollY };
  const before = read();
  // "instant" overrides a page's `scroll-behavior: smooth`, so the card can anchor right away.
  const options: ScrollToOptions = { left: delta.x, top: delta.y, behavior: "instant" };
  if (el) el.scrollBy(options);
  else window.scrollBy(options);
  const after = read();
  return offsetRect(target, before.x - after.x, before.y - after.y);
};

const viewportBox = (): Rect => {
  const root = document.documentElement;
  return { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight };
};

/**
 * Scrolls `from` and each scrollable ancestor, then the window, until `target` (viewport
 * coordinates, measured inside `from`) is visible. Neither focus nor the selection change.
 */
export const scrollRectIntoView = (target: Rect, from: Element): void => {
  let rect = target;
  const page = document.scrollingElement;
  for (let el: Element | null = from; el; el = parentOf(el)) {
    if (el === page || el === document.body || el === document.documentElement) break;
    if (canScroll(el)) rect = scrollBox(rect, visibleBox(el as HTMLElement), el);
  }
  scrollBox(rect, viewportBox(), null);
};
