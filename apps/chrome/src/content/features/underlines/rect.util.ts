/** A plain rectangle in viewport coordinates (CSS pixels). */
export type Rect = { left: number; top: number; width: number; height: number };

const right = (r: Rect): number => r.left + r.width;
const bottom = (r: Rect): number => r.top + r.height;

/** Moves a rect by (dx, dy). */
export const offsetRect = (r: Rect, dx: number, dy: number): Rect => ({
  ...r,
  left: r.left + dx,
  top: r.top + dy,
});

/** The part of `r` inside `box`, or null when nothing of it is visible. */
export const clipRect = (r: Rect, box: Rect): Rect | null => {
  const left = Math.max(r.left, box.left);
  const top = Math.max(r.top, box.top);
  const width = Math.min(right(r), right(box)) - left;
  const height = Math.min(bottom(r), bottom(box)) - top;
  if (width <= 0 || height <= 0) return null;
  return { left, top, width, height };
};

/** Clips every rect to `box`, dropping those fully outside it. */
export const clipRects = (rects: readonly Rect[], box: Rect): Rect[] =>
  rects.flatMap((r) => {
    const clipped = clipRect(r, box);
    return clipped ? [clipped] : [];
  });
