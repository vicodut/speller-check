import { describe, expect, test } from "bun:test";
import { cellStats, median, msPerLetter, rowLetters } from "./statistics-aggregate.util";

const samples = (pairs: [number, number][]) => pairs.map(([letters, ms]) => [letters, ms] as const);

describe("median", () => {
  test("the middle value, or the mean of the two middle values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("msPerLetter", () => {
  test("is null with fewer than five ok samples", () => {
    expect(
      msPerLetter(
        samples([
          [10, 50],
          [10, 60],
          [10, 70],
          [10, 80],
        ]),
      ),
    ).toBeNull();
  });

  test("is the median of ms per letter from five ok samples, to one decimal place", () => {
    // ratios 5, 10, 15, 20, 25 -> median 15
    expect(
      msPerLetter(
        samples([
          [10, 50],
          [10, 100],
          [10, 150],
          [10, 200],
          [10, 250],
        ]),
      ),
    ).toBe(15);
    // ratios 3.33, 10, 10, 10, 10 -> median 10
    expect(
      msPerLetter(
        samples([
          [3, 10],
          [1, 10],
          [1, 10],
          [1, 10],
          [1, 10],
        ]),
      ),
    ).toBe(10);
    // ratios 1, 1, 1, 1, 3.33 -> median 1
    expect(
      msPerLetter(
        samples([
          [1, 1],
          [1, 1],
          [1, 1],
          [1, 1],
          [3, 10],
        ]),
      ),
    ).toBe(1);
    // ratios 1, 2, 3.33, 4, 5 -> median 3.33, shown as 3.3
    expect(
      msPerLetter(
        samples([
          [1, 1],
          [1, 2],
          [3, 10],
          [1, 4],
          [1, 5],
        ]),
      ),
    ).toBe(3.3);
  });
});

describe("cellStats", () => {
  test("letters total counts ok samples only; failures are counted by code", () => {
    expect(
      cellStats({
        ok: samples([
          [10, 50],
          [20, 100],
        ]),
        failures: { timeout: 1, invalid_json: 2 },
      }),
    ).toEqual({ msPerLetter: null, okCount: 2, failureCount: 3, letters: 30 });
  });

  test("no samples at all is an empty cell", () => {
    expect(cellStats({ ok: [], failures: {} })).toEqual({
      msPerLetter: null,
      okCount: 0,
      failureCount: 0,
      letters: 0,
    });
  });
});

describe("rowLetters", () => {
  test("the letters of both features' ok samples added together", () => {
    const check = cellStats({
      ok: samples([
        [10, 50],
        [5, 20],
      ]),
      failures: { timeout: 4 },
    });
    const rephrase = cellStats({ ok: samples([[7, 30]]), failures: { invalid_json: 1 } });
    expect(rowLetters([check, rephrase])).toBe(22);
  });

  test("a feature never run adds nothing, and failures add no letters", () => {
    const check = cellStats({ ok: [], failures: { timeout: 3 } });
    const rephrase = cellStats({ ok: samples([[12, 40]]), failures: {} });
    expect(rowLetters([check, rephrase])).toBe(12);
  });
});
