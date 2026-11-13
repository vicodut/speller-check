import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StatisticsFileRepository } from "./statistics-file.repository";
import type { StatisticsFile } from "./statistics-file.schema";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-statistics-file-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const file: StatisticsFile = {
  version: 1,
  removed: [{ profileId: "p0", name: "Old" }],
  entries: [
    {
      feature: "check",
      profileId: "p1",
      model: "qwen3:8b",
      local: true,
      ok: [[120, 480]],
      failures: { timeout: 1 },
    },
  ],
};

describe("StatisticsFileRepository", () => {
  test("no file yet loads as null", async () => {
    expect(await new StatisticsFileRepository(join(dir, "statistics.json")).load()).toEqual({
      ok: true,
      value: null,
    });
  });

  test("saves (creating the folder) and loads the same numbers back, with no temp file left", async () => {
    const repo = new StatisticsFileRepository(join(dir, "nested", "statistics.json"));
    expect((await repo.save(file)).ok).toBe(true);
    expect(await repo.load()).toEqual({ ok: true, value: file });
    expect(await readdir(join(dir, "nested"))).toEqual(["statistics.json"]);
  });

  test("a file that isn't valid JSON, or doesn't match the schema, fails to load", async () => {
    const path = join(dir, "statistics.json");
    const repo = new StatisticsFileRepository(path);
    await writeFile(path, "{not json");
    expect(await repo.load()).toEqual({ ok: false, error: { code: "statistics_read_failed" } });
    await writeFile(path, JSON.stringify({ version: 1, entries: [{ feature: "check" }] }));
    expect(await repo.load()).toEqual({ ok: false, error: { code: "statistics_read_failed" } });
  });

  test("a saved file from before word counts (letters and ms only) still loads", async () => {
    const path = join(dir, "statistics.json");
    await writeFile(path, JSON.stringify(file));
    expect(await new StatisticsFileRepository(path).load()).toEqual({ ok: true, value: file });
  });

  test("a sample with its word count saved beside letters and ms loads back", async () => {
    const path = join(dir, "statistics.json");
    const entry: StatisticsFile["entries"][number] = {
      feature: "check",
      profileId: "p1",
      model: "qwen3:8b",
      local: true,
      ok: [[120, 480, 20]],
      failures: { timeout: 1 },
    };
    const withWords: StatisticsFile = { ...file, entries: [entry] };
    await writeFile(path, JSON.stringify(withWords));
    expect(await new StatisticsFileRepository(path).load()).toEqual({ ok: true, value: withWords });
  });

  test("a file holding anything but numbers and codes is refused", async () => {
    const path = join(dir, "statistics.json");
    const withText = { ...file, entries: [{ ...file.entries[0], failures: { "a note": 1 } }] };
    await writeFile(path, JSON.stringify(withText));
    expect((await new StatisticsFileRepository(path).load()).ok).toBe(false);
  });
});
