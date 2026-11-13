import { describe, expect, test } from "bun:test";
import { ok } from "../../shared/result";
import { StatisticsRecorder } from "./statistics.recorder";
import { answered, memoryStore, quiet } from "./statistics-recorder.fixture";

describe("StatisticsRecorder kept names", () => {
  test("a deleted profile's last name is kept beside its rows, and survives a restart", async () => {
    const { store, saved } = memoryStore();
    const first = new StatisticsRecorder(store, quiet());
    await first.load();
    first.record([answered(480)]);
    first.markRemoved("p1", "Local");
    await first.flush();
    expect(saved()?.removed).toEqual([{ profileId: "p1", name: "Local" }]);

    const restarted = new StatisticsRecorder(store, quiet());
    await restarted.load();
    expect(restarted.removedName("p1")).toBe("Local");
    expect(restarted.entries()).toHaveLength(1);
  });

  test("the name kept is the last one given", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    recorder.markRemoved("p1", "Old name");
    recorder.markRemoved("p1", "New name");
    expect(recorder.removedName("p1")).toBe("New name");
  });

  test("a deleted profile with no rows keeps no name", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.markRemoved("p9", "Unused");
    await recorder.flush();
    expect(recorder.removedName("p9")).toBeUndefined();
    expect(saved()).toBeNull();
  });

  test("clear forgets the kept names too", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    recorder.markRemoved("p1", "Local");
    expect(await recorder.clear()).toEqual(ok(undefined));
    expect(recorder.removedName("p1")).toBeUndefined();
    expect(saved()).toEqual({ version: 1, removed: [], entries: [] });
  });
});
