import { describe, expect, test } from "bun:test";
import type { AppError } from "../../shared/errors";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import { StatisticsRecorder } from "./statistics.recorder";
import type { StatisticsFile } from "./statistics-file.schema";
import { answered, failed, identity, memoryStore, quiet } from "./statistics-recorder.fixture";

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
          ok: [[100, 480, 20]],
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

  test("flush resolves only once a pending write has landed, so shutdown keeps the last samples", async () => {
    const { store, saved } = memoryStore();
    let landed = false;
    const slow = {
      load: store.load,
      save: async (file: StatisticsFile): Promise<Result<void, AppError>> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        landed = true;
        return store.save(file);
      },
    };
    const recorder = new StatisticsRecorder(slow, new Logger(() => {}));
    await recorder.load();
    recorder.record([answered(480)]);
    await recorder.flush();
    expect(landed).toBe(true);
    expect(saved()?.entries[0]?.ok).toEqual([[100, 480, 20]]);
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

  test("a failed clear returns the code and keeps the numbers and names, as the file was", async () => {
    const lines: string[] = [];
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, new Logger((l) => lines.push(l)));
    await recorder.load();
    recorder.record([answered(480)]);
    recorder.markRemoved("p1", "Local");
    await recorder.flush();
    const before = saved();
    store.failSaves = true;

    const cleared = await recorder.clear();
    expect(cleared.ok).toBe(false);
    if (!cleared.ok) expect(cleared.error.code).toBe("statistics_write_failed");
    expect(recorder.entries()).toHaveLength(1);
    expect(recorder.removedName("p1")).toBe("Local");
    expect(saved()).toEqual(before);
    expect(lines.join("\n")).toContain('"code":"statistics_write_failed"');
  });
});
