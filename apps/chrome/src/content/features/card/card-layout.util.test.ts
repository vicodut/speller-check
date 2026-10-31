import { describe, expect, test } from "bun:test";
import {
  CARD_HEIGHT_ESTIMATE,
  CARD_WIDTH,
  canAddToDictionary,
  placeCard,
} from "./card-layout.util";

const viewport = { width: 1000, height: 800 };

describe("placeCard", () => {
  test("goes just under the anchor", () => {
    expect(placeCard({ left: 100, top: 200, width: 30, height: 18 }, viewport)).toEqual({
      left: 100,
      top: 222,
    });
  });

  test("stays inside the viewport horizontally", () => {
    const anchor = { left: 950, top: 200, width: 30, height: 18 };
    expect(placeCard(anchor, viewport).left).toBe(1000 - CARD_WIDTH - 8);
    expect(placeCard({ ...anchor, left: -20 }, viewport).left).toBe(8);
  });

  test("flips above the anchor near the bottom", () => {
    const anchor = { left: 100, top: 750, width: 30, height: 18 };
    expect(placeCard(anchor, viewport).top).toBe(750 - 4 - CARD_HEIGHT_ESTIMATE);
  });

  test("stays below when there's no room above either", () => {
    const anchor = { left: 100, top: 100, width: 30, height: 18 };
    expect(placeCard(anchor, { width: 1000, height: 200 }).top).toBe(122);
  });
});

describe("canAddToDictionary", () => {
  test("allows spelling issues", () => {
    expect(canAddToDictionary({ type: "spelling", original: "two words" })).toBe(true);
  });

  test("allows a single word of another type", () => {
    expect(canAddToDictionary({ type: "grammar", original: "l'école" })).toBe(true);
  });

  test("refuses phrases and bare punctuation", () => {
    expect(canAddToDictionary({ type: "grammar", original: "he go" })).toBe(false);
    expect(canAddToDictionary({ type: "punctuation", original: "," })).toBe(false);
  });
});
