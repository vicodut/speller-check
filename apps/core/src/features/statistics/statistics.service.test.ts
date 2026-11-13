import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { answered, build, memoryStore, names } from "./statistics.fixture";
import { StatisticsRecorder } from "./statistics.recorder";
import { StatisticsService } from "./statistics.service";
import type { StatisticsFile } from "./statistics-file.schema";

describe("StatisticsService.view", () => {
  test("no samples is no rows", async () => {
    expect((await build([])).view()).toEqual({ rows: [] });
  });

  test("one row per profile and model, with each feature's cell", async () => {
    const service = await build([
      answered("check", "p1", "qwen3:8b", 50),
      answered("rephrase", "p1", "qwen3:8b", 90),
      answered("check", "p2", "gpt", 200),
    ]);
    const { rows } = service.view();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      profileId: "p1",
      profileName: "Local",
      deleted: false,
      model: "qwen3:8b",
      local: true,
      letters: 20,
      words: 4,
      check: {
        msPerLetter: null,
        msPerWord: null,
        okCount: 1,
        failureCount: 0,
        letters: 10,
        words: 2,
      },
      rephrase: {
        msPerLetter: null,
        msPerWord: null,
        okCount: 1,
        failureCount: 0,
        letters: 10,
        words: 2,
      },
    });
    expect(rows[1]).toMatchObject({
      profileName: "Cloud",
      local: false,
      letters: 10,
      words: 2,
      check: { okCount: 1 },
      rephrase: { okCount: 0, failureCount: 0, letters: 0 },
    });
  });

  test("a row's letters total counts ok samples of both features only", async () => {
    const service = await build([
      answered("check", "p1", "qwen3:8b", 50, 30),
      answered("rephrase", "p1", "qwen3:8b", 90, 12),
      {
        kind: "failure",
        feature: "rephrase",
        identity: { profileId: "p1", model: "qwen3:8b", local: true },
        code: "timeout",
      },
    ]);
    expect(service.view().rows[0]?.letters).toBe(42);
  });

  test("a row's words total counts ok samples of both features that have a word count", async () => {
    const service = await build([
      answered("check", "p1", "qwen3:8b", 50, 30, 3),
      answered("rephrase", "p1", "qwen3:8b", 90, 12, 4),
    ]);
    expect(service.view().rows[0]?.words).toBe(7);
  });

  test("a saved sample from before word counts adds letters but no words or per-word median", async () => {
    const saved: StatisticsFile = {
      version: 1,
      removed: [],
      entries: [
        {
          feature: "check",
          profileId: "p1",
          model: "m",
          local: true,
          ok: [[10, 50]],
          failures: {},
        },
      ],
    };
    const recorder = new StatisticsRecorder(
      { load: async () => ok(saved), save: async () => ok(undefined) },
      new Logger(() => {}),
    );
    await recorder.load();
    const service = new StatisticsService(recorder, (id) => names[id]);
    recorder.record([50, 100, 150, 200].map((ms) => answered("check", "p1", "m", ms)));
    const cell = service.view().rows[0]?.check;
    expect(cell).toEqual({
      msPerLetter: 10,
      msPerWord: null,
      okCount: 5,
      failureCount: 0,
      letters: 50,
      words: 8,
    });
    recorder.record([answered("check", "p1", "m", 250)]);
    const full = service.view().rows[0]?.check;
    expect(full).toEqual({
      msPerLetter: 12.5,
      msPerWord: 75,
      okCount: 6,
      failureCount: 0,
      letters: 60,
      words: 10,
    });
  });

  test("a profile that is no longer saved is shown without a name", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "gone", "m", 50)]);
    const service = new StatisticsService(recorder, () => undefined);
    expect(service.view().rows[0]?.profileName).toBe("Removed profile");
  });

  test("four ok samples still show no median; the count does", async () => {
    const samples = [50, 100, 150, 200].map((ms) => answered("check", "p1", "m", ms));
    const { rows } = (await build(samples)).view();
    expect(rows[0]?.check).toEqual({
      msPerLetter: null,
      msPerWord: null,
      okCount: 4,
      failureCount: 0,
      letters: 40,
      words: 8,
    });
  });

  test("the median per letter appears from five ok samples", async () => {
    const samples = [50, 100, 150, 200, 250].map((ms) => answered("check", "p1", "m", ms));
    const { rows } = (await build(samples)).view();
    expect(rows[0]?.check).toEqual({
      msPerLetter: 15,
      msPerWord: 75,
      okCount: 5,
      failureCount: 0,
      letters: 50,
      words: 10,
    });
  });
});
