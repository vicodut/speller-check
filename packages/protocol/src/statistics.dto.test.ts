import { describe, expect, test } from "bun:test";
import { StatisticsView } from "./statistics.dto";

const cell = { msPerLetter: null, okCount: 0, failureCount: 0, letters: 0 };

describe("StatisticsView", () => {
  test("accepts rows with both cells", () => {
    const view = {
      rows: [
        {
          profileId: "p1",
          profileName: "Local",
          model: "qwen3:8b",
          local: true,
          check: { msPerLetter: 4.8, okCount: 6, failureCount: 1, letters: 720 },
          rephrase: cell,
        },
      ],
    };
    expect(StatisticsView.safeParse(view).success).toBe(true);
  });

  test("refuses a row with any field the page doesn't know about", () => {
    const row = {
      profileId: "p1",
      profileName: "Local",
      model: "m",
      local: true,
      check: cell,
      rephrase: cell,
      apiKey: "x",
    };
    expect(StatisticsView.safeParse({ rows: [row] }).success).toBe(false);
  });
});
