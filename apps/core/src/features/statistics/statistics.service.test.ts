import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import { StatisticsRecorder } from "./statistics.recorder";
import { StatisticsService } from "./statistics.service";

const memoryStore = () => ({
  load: async () => ok(null),
  save: async () => ok(undefined),
});

const names: Record<string, string> = { p1: "Local", p2: "Cloud" };

const build = async (samples: CallSample[]) => {
  const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
  await recorder.load();
  recorder.record(samples);
  return new StatisticsService(recorder, (id) => names[id]);
};

const answered = (
  feature: "check" | "rephrase",
  profileId: string,
  model: string,
  ms: number,
  letters = 10,
): CallSample => ({
  kind: "ok",
  feature,
  identity: { profileId, model, local: profileId === "p1" },
  letters,
  ms,
});

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
      model: "qwen3:8b",
      local: true,
      check: { msPerLetter: null, okCount: 1, failureCount: 0, letters: 10 },
      rephrase: { msPerLetter: null, okCount: 1, failureCount: 0, letters: 10 },
    });
    expect(rows[1]).toMatchObject({
      profileName: "Cloud",
      local: false,
      check: { okCount: 1 },
      rephrase: { okCount: 0, failureCount: 0, letters: 0 },
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
    expect(rows[0]?.check).toEqual({ msPerLetter: null, okCount: 4, failureCount: 0, letters: 40 });
  });

  test("the median per letter appears from five ok samples", async () => {
    const samples = [50, 100, 150, 200, 250].map((ms) => answered("check", "p1", "m", ms));
    const { rows } = (await build(samples)).view();
    expect(rows[0]?.check).toEqual({ msPerLetter: 15, okCount: 5, failureCount: 0, letters: 50 });
  });

  test("clear forgets every row and answers the empty view", async () => {
    const service = await build([answered("check", "p1", "m", 50)]);
    expect(await service.clear()).toEqual({ ok: true, value: { rows: [] } });
    expect(service.view()).toEqual({ rows: [] });
  });

  test("clear also forgets the rows of deleted profiles", async () => {
    const service = await build([
      answered("check", "p1", "m", 50),
      answered("rephrase", "gone", "m", 80),
    ]);
    expect(service.view().rows.map((r) => r.profileName)).toContain("Removed profile");
    expect(await service.clear()).toEqual({ ok: true, value: { rows: [] } });
    expect(service.view()).toEqual({ rows: [] });
  });

  test("after clear, new calls start the statistics again from zero", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "p1", "m", 50, 10)]);
    const service = new StatisticsService(recorder, (id) => names[id]);
    await service.clear();
    recorder.record([answered("check", "p1", "m", 90, 10)]);
    const [row] = service.view().rows;
    expect(row?.check.okCount).toBe(1);
    expect(row?.check.letters).toBe(10);
  });
});
