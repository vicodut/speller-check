import { describe, expect, test } from "bun:test";
import { scrollDelta } from "./scroll-delta.util";

const box = { left: 0, top: 100, width: 200, height: 100 };
const rect = (left: number, top: number, width = 20, height = 10) => ({ left, top, width, height });

describe("scrollDelta", () => {
  test("leaves a visible rect alone", () => {
    expect(scrollDelta(rect(10, 150), box)).toEqual({ x: 0, y: 0 });
  });

  test("scrolls down to a rect below the box, with a margin", () => {
    // Bottom at 310 must land at 200 - 8.
    expect(scrollDelta(rect(10, 300), box, 8)).toEqual({ x: 0, y: 118 });
  });

  test("scrolls up to a rect above the box, with a margin", () => {
    expect(scrollDelta(rect(10, 20), box, 8)).toEqual({ x: 0, y: -88 });
  });

  test("scrolls sideways (single-line inputs)", () => {
    expect(scrollDelta(rect(250, 150), box, 0)).toEqual({ x: 70, y: 0 });
    expect(scrollDelta(rect(-40, 150), box, 0)).toEqual({ x: -40, y: 0 });
  });

  test("scrolls a partly hidden rect fully in", () => {
    expect(scrollDelta(rect(10, 195), box, 0)).toEqual({ x: 0, y: 5 });
  });

  test("shrinks the margin when the box barely fits the rect", () => {
    // 100 - 90 leaves 10 of slack: at most 5 on each side.
    expect(scrollDelta(rect(10, 300, 20, 90), box, 8)).toEqual({ x: 0, y: 195 });
  });

  test("aligns the start of a rect taller than the box", () => {
    expect(scrollDelta(rect(10, 300, 20, 150), box, 8)).toEqual({ x: 0, y: 200 });
    expect(scrollDelta(rect(10, 50, 20, 150), box, 8)).toEqual({ x: 0, y: -50 });
  });

  test("keeps a big rect that already covers the box start", () => {
    expect(scrollDelta(rect(10, 100, 20, 150), box, 8)).toEqual({ x: 0, y: 0 });
  });
});
