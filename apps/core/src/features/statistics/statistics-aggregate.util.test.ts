import { describe, expect, test } from "bun:test";
import { median, msPerLetter, msPerWord } from "./statistics-aggregate.util";

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

describe("msPerWord", () => {
  test("is null with fewer than five ok samples that have a word count", () => {
    expect(
      msPerWord([
        [10, 50, 5],
        [10, 60, 5],
        [10, 70, 5],
        [10, 80, 5],
      ]),
    ).toBeNull();
  });

  test("is the median of ms per word from five samples with words, to one decimal place", () => {
    // ms per word 5, 10, 15, 20, 25 -> median 15
    expect(
      msPerWord([
        [10, 50, 10],
        [10, 100, 10],
        [10, 150, 10],
        [10, 200, 10],
        [10, 250, 10],
      ]),
    ).toBe(15);
    // ms per word 1, 2, 3.33, 4, 5 -> median 3.33, shown as 3.3
    expect(
      msPerWord([
        [1, 1, 1],
        [1, 2, 1],
        [3, 10, 3],
        [1, 4, 1],
        [1, 5, 1],
      ]),
    ).toBe(3.3);
  });

  test("an old sample with no word count is left out of the median and of the count", () => {
    // four samples with words: not enough, even with the old one beside them
    expect(
      msPerWord([
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 9000],
      ]),
    ).toBeNull();
    // five with words: the median is theirs alone (all 5), the old 9000 ms sample is ignored
    expect(
      msPerWord([
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 9000],
      ]),
    ).toBe(5);
  });

  test("a sample with zero words has no ms per word and is left out", () => {
    expect(
      msPerWord([
        [10, 50, 0],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
        [10, 50, 10],
      ]),
    ).toBe(5);
  });
});
