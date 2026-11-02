import type { Rect } from "./rect.util";

/** How far to scroll a box so a rect inside its content shows; positive scrolls right/down. */
export type ScrollDelta = { x: number; y: number };

const axisDelta = (
  start: number,
  size: number,
  boxStart: number,
  boxSize: number,
  margin: number,
): number => {
  // Too big to fit: show its start.
  if (size >= boxSize) return start - boxStart;
  const m = Math.min(margin, (boxSize - size) / 2);
  if (start < boxStart) return start - boxStart - m;
  const overflow = start + size - (boxStart + boxSize);
  return overflow > 0 ? overflow + m : 0;
};

/**
 * The smallest scroll that brings `target` fully inside `box` (both in the same coordinates),
 * leaving up to `margin` pixels around it. Zero on an axis where it already fits.
 */
export const scrollDelta = (target: Rect, box: Rect, margin = 0): ScrollDelta => ({
  x: axisDelta(target.left, target.width, box.left, box.width, margin),
  y: axisDelta(target.top, target.height, box.top, box.height, margin),
});
