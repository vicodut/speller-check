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

const PANEL_GAP = 6;

/**
 * Where the issue list opens: right-aligned with the badge, above it when there's room for
 * `panelHeight`, else below. Values are CSS `right` plus `top` or `bottom`, in viewport px.
 */
export const panelPlacement = (
  badge: { left: number; top: number },
  viewport: { width: number; height: number },
  panelHeight: number,
): { right: number; top?: number; bottom?: number } => {
  const right = Math.max(0, viewport.width - (badge.left + BADGE_SIZE));
  if (badge.top - PANEL_GAP >= panelHeight) {
    return { right, bottom: viewport.height - badge.top + PANEL_GAP };
  }
  return { right, top: badge.top + BADGE_SIZE + PANEL_GAP };
};
