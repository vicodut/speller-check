import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstRunFile } from "./profiles.util";
import { SettingsFileRepository } from "./settings-file.repository";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-settings-file-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("SettingsFileRepository", () => {
  test("first run: no file loads as null", async () => {
    expect(await new SettingsFileRepository(join(dir, "settings.json")).load()).toEqual({
      ok: true,
      value: null,
    });
  });

  test("saves (creating the folder) and loads the same file back, with no temp file left", async () => {
    const path = join(dir, "nested", "settings.json");
    const repo = new SettingsFileRepository(path);
    expect((await repo.save(firstRunFile("p1"))).ok).toBe(true);
    expect(await repo.load()).toEqual({ ok: true, value: firstRunFile("p1") });
    expect(await readdir(join(dir, "nested"))).toEqual(["settings.json"]);
  });

  test("a file that isn't valid JSON or a valid settings file fails to load", async () => {
    const path = join(dir, "settings.json");
    const repo = new SettingsFileRepository(path);
    await writeFile(path, "{not json");
    expect(await repo.load()).toEqual({ ok: false, error: { code: "settings_read_failed" } });
    await writeFile(path, JSON.stringify({ ...firstRunFile("p1"), activeProfileId: "ghost" }));
    expect(await repo.load()).toEqual({ ok: false, error: { code: "settings_read_failed" } });
  });
});
