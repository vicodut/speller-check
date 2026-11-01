import { describe, expect, test } from "bun:test";
import { BADGE_SIZE, badgePosition, type FieldBox } from "./badge-position.util";

const box = (extra: Partial<FieldBox> = {}): FieldBox => ({
  left: 100,
  top: 50,
  width: 400,
  height: 140,
  borderRight: 1,
  borderBottom: 1,
  scrollbarX: 0,
  scrollbarY: 0,
  ...extra,
});

describe("badgePosition", () => {
  test("sits inside the bottom-right corner", () => {
    expect(badgePosition(box())).toEqual({
      left: 100 + 400 - 1 - 6 - BADGE_SIZE,
      top: 50 + 140 - 1 - 6 - BADGE_SIZE,
    });
  });

  test("stays clear of scrollbars", () => {
    const { left, top } = badgePosition(box({ scrollbarX: 15, scrollbarY: 15 }));
    expect(left).toBe(100 + 400 - 16 - 6 - BADGE_SIZE);
    expect(top).toBe(50 + 140 - 16 - 6 - BADGE_SIZE);
  });

  test("centres vertically in a field too short for the inset", () => {
    expect(badgePosition(box({ height: 24, borderBottom: 0 })).top).toBe(
      50 + (24 - BADGE_SIZE) / 2,
    );
  });

  test("never starts before the field in a tiny field", () => {
    expect(badgePosition(box({ width: 10, borderRight: 0 })).left).toBe(100);
  });
});
