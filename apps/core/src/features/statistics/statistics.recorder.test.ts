import { describe, expect, test } from "bun:test";
import type { AppError } from "../../shared/errors";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import { StatisticsRecorder } from "./statistics.recorder";
import type { StatisticsFile } from "./statistics-file.schema";

/** An in-memory stand-in for the statistics file: what was last saved, and whether saves fail. */
const memoryStore = (initial: Result<StatisticsFile | null, AppError> = ok(null)) => {
  let saved: StatisticsFile | null = null;
  const store = {
    failSaves: false,
    load: async () => (saved ? ok(structuredClone(saved)) : initial),
    save: async (file: StatisticsFile): Promise<Result<void, AppError>> => {
      if (store.failSaves) return err(appError("statistics_write_failed"));
      saved = structuredClone(file);
      return ok(undefined);
    },
  };
  return { store, saved: () => saved };
};

const identity = { profileId: "p1", model: "qwen3:8b", local: true };
const answered = (ms: number, letters = 100): CallSample => ({
  kind: "ok",
  feature: "check",
  identity,
  letters,
  ms,
});
const failed = (code: "timeout" | "invalid_json"): CallSample => ({
  kind: "failure",
  feature: "check",
  identity,
  code,
});

const quiet = () => new Logger(() => {});

describe("StatisticsRecorder", () => {
  test("samples are stored as numbers and codes, and survive a restart", async () => {
    const { store, saved } = memoryStore();
    const first = new StatisticsRecorder(store, quiet());
    await first.load();
    first.record([answered(480), failed("timeout")]);
    await first.flush();
    expect(saved()).toEqual({
      version: 1,
      removed: [],
      entries: [
        {
          feature: "check",
          profileId: "p1",
          model: "qwen3:8b",
          local: true,
          ok: [[100, 480]],
          failures: { timeout: 1 },
        },
      ],
    });

    const restarted = new StatisticsRecorder(store, quiet());
    await restarted.load();
    expect(restarted.entries()).toEqual(first.entries());
  });

  test("a profile with two models keeps two entries", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([
      answered(480),
      { ...answered(300), identity: { ...identity, model: "mistral" } },
    ]);
    expect(recorder.entries().map((e) => e.model)).toEqual(["qwen3:8b", "mistral"]);
  });

  test("a missing file starts empty without logging a failure", async () => {
    const lines: string[] = [];
    const recorder = new StatisticsRecorder(memoryStore().store, new Logger((l) => lines.push(l)));
    await recorder.load();
    expect(recorder.entries()).toEqual([]);
    expect(lines.some((l) => l.includes('"statistics.load_failed"'))).toBe(false);
  });

  test("a corrupt file starts empty and logs only the code", async () => {
    const lines: string[] = [];
    const corrupt = memoryStore(err(appError("statistics_read_failed"))).store;
    const recorder = new StatisticsRecorder(corrupt, new Logger((l) => lines.push(l)));
    await recorder.load();
    expect(recorder.entries()).toEqual([]);
    expect(lines.join("\n")).toContain('"code":"statistics_read_failed"');
  });

  test("nothing recorded means nothing saved", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([]);
    await recorder.flush();
    expect(saved()).toBeNull();
  });

  test("clear empties the statistics and saves the empty file", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    expect(await recorder.clear()).toEqual(ok(undefined));
    expect(recorder.entries()).toEqual([]);
    expect(saved()).toEqual({ version: 1, removed: [], entries: [] });
  });

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

  test("a failed save is logged by code, and the numbers stay in memory", async () => {
    const lines: string[] = [];
    const { store } = memoryStore();
    store.failSaves = true;
    const recorder = new StatisticsRecorder(store, new Logger((l) => lines.push(l)));
    await recorder.load();
    recorder.record([answered(480)]);
    await recorder.flush();
    expect(recorder.entries()).toHaveLength(1);
    expect(lines.join("\n")).toContain('"code":"statistics_write_failed"');
  });
});
