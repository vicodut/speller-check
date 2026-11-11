import { describe, expect, test } from "bun:test";
import { settingsPageDir } from "./settings-page-dir.util";

const SOURCE_DIR = "/repo/apps/core/src/cli";

describe("settingsPageDir", () => {
  test("from source: the settings-web build in the repo", () => {
    const dir = settingsPageDir({}, "/usr/local/bin/bun", SOURCE_DIR);
    expect(dir).toBe("/repo/apps/settings-web/dist");
  });

  test("compiled: the settings folder beside the binary", () => {
    const dir = settingsPageDir({}, "/opt/gc/gc-core", "/$bunfs/root");
    expect(dir).toBe("/opt/gc/settings");
  });

  test("compiled on Windows-style virtual root too", () => {
    const dir = settingsPageDir({}, "/opt/gc/gc-core", "B:/~BUN/root");
    expect(dir).toBe("/opt/gc/settings");
  });

  test("GC_SETTINGS_PAGE_DIR wins over both", () => {
    const env = { GC_SETTINGS_PAGE_DIR: "/custom/page" };
    expect(settingsPageDir(env, "/opt/gc/gc-core", "/$bunfs/root")).toBe("/custom/page");
    expect(settingsPageDir(env, "/usr/local/bin/bun", SOURCE_DIR)).toBe("/custom/page");
  });

  test("an empty GC_SETTINGS_PAGE_DIR is ignored", () => {
    const dir = settingsPageDir({ GC_SETTINGS_PAGE_DIR: " " }, "/opt/gc/gc-core", "/$bunfs/root");
    expect(dir).toBe("/opt/gc/settings");
  });
});
