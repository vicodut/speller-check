export type FieldBox = {
  /** Viewport rect of the field's border box. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Right and bottom border widths. */
  readonly borderRight: number;
  readonly borderBottom: number;
  /** Width of the vertical scrollbar and height of the horizontal one (0 when absent). */
  readonly scrollbarX: number;
  readonly scrollbarY: number;
};

export const BADGE_SIZE = 16;
const INSET = 6;

/** Places one axis: inside the far edge when there's room, centred when the field is too small. */
const placeAxis = (start: number, length: number, trailing: number): number => {
  const room = length - trailing;
  if (room < BADGE_SIZE + 2 * INSET) return start + Math.max(0, (room - BADGE_SIZE) / 2);
  return start + room - INSET - BADGE_SIZE;
};

/** Viewport position of the badge: inside the field's bottom-right corner, clear of scrollbars. */
export const badgePosition = (box: FieldBox): { left: number; top: number } => ({
  left: placeAxis(box.left, box.width, box.borderRight + box.scrollbarX),
  top: placeAxis(box.top, box.height, box.borderBottom + box.scrollbarY),
});
