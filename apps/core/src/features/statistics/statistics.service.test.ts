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
      deleted: false,
      model: "qwen3:8b",
      local: true,
      letters: 20,
      check: { msPerLetter: null, okCount: 1, failureCount: 0, letters: 10 },
      rephrase: { msPerLetter: null, okCount: 1, failureCount: 0, letters: 10 },
    });
    expect(rows[1]).toMatchObject({
      profileName: "Cloud",
      local: false,
      letters: 10,
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

describe("StatisticsService through rename, delete and model change", () => {
  /** The live profile names, as the settings service answers them; the test edits it. */
  const liveNames = (live: Record<string, string>) => (id: string) => live[id];

  test("a rename keeps the history under the same profile and shows the new name", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "p1", "qwen3:8b", 50)]);
    const live: Record<string, string> = { p1: "Local" };
    const service = new StatisticsService(recorder, liveNames(live));
    live.p1 = "Home";
    const { rows } = service.view();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profileId: "p1", profileName: "Home", deleted: false });
    expect(rows[0]?.check.okCount).toBe(1);
  });

  test("a deleted profile keeps its rows, shown with its last name and marked deleted", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "p1", "qwen3:8b", 50)]);
    recorder.markRemoved("p1", "Home");
    const service = new StatisticsService(recorder, () => undefined);
    expect(service.view().rows).toEqual([
      expect.objectContaining({
        profileId: "p1",
        profileName: "Home",
        deleted: true,
        check: expect.objectContaining({ okCount: 1 }),
      }),
    ]);
  });

  test("a deleted profile with no kept name is still labelled deleted", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "gone", "m", 50)]);
    const service = new StatisticsService(recorder, () => undefined);
    expect(service.view().rows[0]).toMatchObject({ profileName: "Removed profile", deleted: true });
  });

  test("a profile created after a deletion never shares its history", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([answered("check", "p1", "m", 50)]);
    recorder.markRemoved("p1", "Old");
    recorder.record([answered("check", "p3", "m", 90)]);
    const service = new StatisticsService(recorder, liveNames({ p3: "New" }));
    const { rows } = service.view();
    expect(rows.map((r) => [r.profileId, r.profileName, r.deleted, r.check.okCount])).toEqual([
      ["p1", "Old", true, 1],
      ["p3", "New", false, 1],
    ]);
  });

  test("changing a profile's model starts a new row and the old row stays", async () => {
    const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
    await recorder.load();
    recorder.record([
      answered("check", "p1", "qwen3:8b", 50),
      answered("check", "p1", "qwen3:8b", 60),
    ]);
    recorder.record([answered("check", "p1", "mistral", 70)]);
    const service = new StatisticsService(recorder, liveNames({ p1: "Local" }));
    expect(service.view().rows.map((r) => [r.model, r.check.okCount])).toEqual([
      ["qwen3:8b", 2],
      ["mistral", 1],
    ]);
  });
});
