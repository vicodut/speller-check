import { describe, expect, test } from "bun:test";
import { parseSettings } from "./extension-settings";
import { DEFAULT_PORT } from "./extension-settings.schema";

describe("parseSettings", () => {
  test("returns defaults for missing data", () => {
    expect(parseSettings(undefined)).toEqual({ token: "", port: DEFAULT_PORT, blockedSites: [] });
  });

  test("fills missing fields with defaults", () => {
    expect(parseSettings({ token: "abc" })).toEqual({
      token: "abc",
      port: DEFAULT_PORT,
      blockedSites: [],
    });
  });

  test("returns defaults for invalid data", () => {
    expect(parseSettings({ token: 3, port: "x" }).port).toBe(DEFAULT_PORT);
    expect(parseSettings({ port: 70000 }).port).toBe(DEFAULT_PORT);
    expect(parseSettings("garbage").token).toBe("");
  });

  test("keeps valid settings", () => {
    const settings = { token: "t", port: 8000, blockedSites: ["bank.com"] };
    expect(parseSettings(settings)).toEqual(settings);
  });
});
