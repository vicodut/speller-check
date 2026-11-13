import { describe, expect, test } from "bun:test";
import { StatisticsView } from "./statistics.dto";

const cell = {
  msPerLetter: null,
  msPerWord: null,
  okCount: 0,
  failureCount: 0,
  letters: 0,
  words: null,
};

describe("StatisticsView", () => {
  test("accepts rows with both cells", () => {
    const view = {
      rows: [
        {
          profileId: "p1",
          profileName: "Local",
          deleted: false,
          model: "qwen3:8b",
          local: true,
          letters: 720,
          words: 140,
          check: {
            msPerLetter: 4.8,
            msPerWord: 24,
            okCount: 6,
            failureCount: 1,
            letters: 720,
            words: 140,
          },
          rephrase: cell,
        },
      ],
    };
    expect(StatisticsView.safeParse(view).success).toBe(true);
  });

  test("refuses a row without the deleted flag", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      model: "m",
      local: true,
      letters: 0,
      words: null,
      check: cell,
      rephrase: cell,
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });

  test("refuses a row without the total letters", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "m",
      local: true,
      words: null,
      check: cell,
      rephrase: cell,
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });

  test("refuses a row without the total words", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "m",
      local: true,
      letters: 0,
      check: cell,
      rephrase: cell,
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });

  test("refuses a cell without the per-word median", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "m",
      local: true,
      letters: 0,
      words: null,
      check: { msPerLetter: null, okCount: 0, failureCount: 0, letters: 0, words: null },
      rephrase: cell,
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });

  test("refuses a row with any field the page doesn't know about", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "m",
      local: true,
      letters: 0,
      words: null,
      check: cell,
      rephrase: cell,
      apiKey: "x",
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });
});
