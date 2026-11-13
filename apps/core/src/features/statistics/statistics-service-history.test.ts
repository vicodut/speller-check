import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import { answered, build, memoryStore, names } from "./statistics.fixture";
import { StatisticsRecorder } from "./statistics.recorder";
import { StatisticsService } from "./statistics.service";

describe("StatisticsService.clear", () => {
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
