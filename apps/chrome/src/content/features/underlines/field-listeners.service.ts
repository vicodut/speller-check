import type { WatchedField } from "../../shared/issue-view";

export type FieldHandlers = {
  /** Layout may have moved: redraw (callers throttle this). */
  reposition(): void;
  /** The user put the caret at `offset` by clicking or with a navigation key. */
  caret(offset: number): void;
  /** The field lost focus. */
  blur(): void;
};

/** Keys that move the caret; typing keys are ignored so the card doesn't pop up mid-word. */
const NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const collapsedCaret = (field: WatchedField): number | null => {
  const { selectionStart, selectionEnd } = field;
  return selectionStart !== null && selectionStart === selectionEnd ? selectionStart : null;
};

/** Listens to the field and the window; returns a function that removes every listener. */
export const attachFieldListeners = (field: WatchedField, on: FieldHandlers): (() => void) => {
  const passive = { passive: true } as const;
  const windowScroll = { passive: true, capture: true } as const;
  const reposition = () => on.reposition();
  const onCaret = () => {
    const offset = collapsedCaret(field);
    if (offset !== null) on.caret(offset);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (NAVIGATION_KEYS.has(event.key)) onCaret();
  };
  const onBlur = () => on.blur();
  // Widen to HTMLElement: addEventListener overloads don't resolve on the field union.
  const el: HTMLElement = field;
  const observer = new ResizeObserver(reposition);
  observer.observe(field);
  el.addEventListener("scroll", reposition, passive);
  el.addEventListener("input", reposition, passive);
  el.addEventListener("click", onCaret);
  el.addEventListener("keyup", onKeyUp);
  el.addEventListener("blur", onBlur);
  window.addEventListener("scroll", reposition, windowScroll);
  window.addEventListener("resize", reposition, passive);
  return () => {
    observer.disconnect();
    el.removeEventListener("scroll", reposition);
    el.removeEventListener("input", reposition);
    el.removeEventListener("click", onCaret);
    el.removeEventListener("keyup", onKeyUp);
    el.removeEventListener("blur", onBlur);
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
  };
};

/**
 * Closes the card on Escape or a mousedown outside it. Events from inside the closed shadow
 * root are retargeted to `host`, so anything whose path includes it is a click on the card.
 */
export const attachCardDismissal = (host: HTMLElement, close: () => void): (() => void) => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  const onMouseDown = (event: MouseEvent) => {
    if (!event.composedPath().includes(host)) close();
  };
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("mousedown", onMouseDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("mousedown", onMouseDown, true);
  };
};
