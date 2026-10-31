import type { Issue } from "@gc/protocol";

type Box = { left: number; top: number; width: number; height: number };
type Viewport = { width: number; height: number };

export const CARD_WIDTH = 320;
/** Rough card height used to decide whether it fits below the underline. */
export const CARD_HEIGHT_ESTIMATE = 150;
const GAP = 4;
const MARGIN = 8;

/** Where to put the card: under the anchor, or above it when there's no room below. */
export const placeCard = (anchor: Box, viewport: Viewport): { left: number; top: number } => {
  const maxLeft = Math.max(MARGIN, viewport.width - CARD_WIDTH - MARGIN);
  const left = Math.min(Math.max(anchor.left, MARGIN), maxLeft);
  const below = anchor.top + anchor.height + GAP;
  const fitsBelow = below + CARD_HEIGHT_ESTIMATE <= viewport.height - MARGIN;
  const above = anchor.top - GAP - CARD_HEIGHT_ESTIMATE;
  const top = fitsBelow || above < MARGIN ? below : above;
  return { left, top };
};

/** "Add to dictionary" makes sense for spelling issues and single-word originals. */
export const canAddToDictionary = (issue: Pick<Issue, "type" | "original">): boolean => {
  if (issue.type === "spelling") return true;
  const word = issue.original.trim();
  return /\p{L}/u.test(word) && !/\s/u.test(word);
};
