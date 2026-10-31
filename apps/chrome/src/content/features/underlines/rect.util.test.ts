import { describe, expect, test } from "bun:test";
import { clipRect, clipRects, offsetRect } from "./rect.util";

const box = { left: 10, top: 10, width: 100, height: 50 };

describe("offsetRect", () => {
  test("moves the rect", () => {
    expect(offsetRect({ left: 1, top: 2, width: 3, height: 4 }, -1, 5)).toEqual({
      left: 0,
      top: 7,
      width: 3,
      height: 4,
    });
  });
});

describe("clipRect", () => {
  test("keeps a rect fully inside", () => {
    const r = { left: 20, top: 20, width: 10, height: 10 };
    expect(clipRect(r, box)).toEqual(r);
  });

  test("cuts a rect overflowing on the right", () => {
    expect(clipRect({ left: 100, top: 20, width: 30, height: 10 }, box)).toEqual({
      left: 100,
      top: 20,
      width: 10,
      height: 10,
    });
  });

  test("cuts a rect scrolled above the top", () => {
    expect(clipRect({ left: 20, top: 5, width: 10, height: 10 }, box)).toEqual({
      left: 20,
      top: 10,
      width: 10,
      height: 5,
    });
  });

  test("drops a rect fully outside", () => {
    expect(clipRect({ left: 20, top: 70, width: 10, height: 10 }, box)).toBeNull();
  });

  test("drops a rect touching the edge only", () => {
    expect(clipRect({ left: 110, top: 20, width: 10, height: 10 }, box)).toBeNull();
  });
});

describe("clipRects", () => {
  test("clips and filters a list", () => {
    const rects = [
      { left: 20, top: 20, width: 10, height: 10 },
      { left: 20, top: 200, width: 10, height: 10 },
    ];
    expect(clipRects(rects, box)).toEqual(rects.slice(0, 1));
  });
});
