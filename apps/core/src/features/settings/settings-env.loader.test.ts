import { describe, expect, test } from "bun:test";
import { loadEnvModel, loadServeSettings } from "./settings.loader";

describe("loadEnvModel", () => {
  test("is null when no GC_* model variable is set (saved profiles are used)", () => {
    expect(loadEnvModel({})).toEqual({ ok: true, value: null });
    expect(loadEnvModel({ GC_MODEL: "  ", GC_PORT: "7341" })).toEqual({ ok: true, value: null });
  });

  test("reads a complete env model", () => {
    const result = loadEnvModel({
      GC_BASE_URL: "https://openrouter.ai/api/v1/",
      GC_MODEL: "qwen/qwen3.8-flash",
      GC_API_KEY: "sk-test",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        baseUrl: "https://openrouter.ai/api/v1",
        model: "qwen/qwen3.8-flash",
        apiKey: "sk-test",
      },
    });
  });

  test("a partial env model is invalid rather than silently mixed with a profile", () => {
    expect(loadEnvModel({ GC_MODEL: "qwen3:8b" })).toEqual({
      ok: false,
      error: { code: "settings_invalid" },
    });
    expect(loadEnvModel({ GC_REASONING_EFFORT: "none" }).ok).toBe(false);
  });
});

describe("loadServeSettings", () => {
  test("needs no model settings and defaults the settings file next to the dictionary", () => {
    const result = loadServeSettings({}, "/Users/me");
    expect(result.ok && result.value.settingsPath).toBe(
      "/Users/me/Library/Application Support/GrammarChecker/settings.json",
    );
    expect(result.ok && result.value.envModel).toBeNull();
  });

  test("reads GC_SETTINGS_PATH and an env model", () => {
    const result = loadServeSettings(
      { GC_SETTINGS_PATH: "/tmp/s.json", GC_BASE_URL: "http://127.0.0.1:11434/v1", GC_MODEL: "m" },
      "/Users/me",
    );
    expect(result.ok && result.value.settingsPath).toBe("/tmp/s.json");
    expect(result.ok && result.value.envModel?.model).toBe("m");
  });
});
