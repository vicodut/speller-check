import { describe, expect, test } from "bun:test";
import { loadSettings } from "./settings.loader";

const base = { GC_BASE_URL: "http://127.0.0.1:11434/v1/", GC_MODEL: "qwen3:8b" };

describe("loadSettings", () => {
  test("loads required vars, trims the trailing slash and defaults the dictionary path", () => {
    const result = loadSettings(base, "/Users/me");
    expect(result).toEqual({
      ok: true,
      value: {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen3:8b",
        dictionaryPath: "/Users/me/Library/Application Support/GrammarChecker/dictionary.json",
      },
    });
  });

  test("keeps the API key and an explicit dictionary path", () => {
    const result = loadSettings(
      { ...base, GC_API_KEY: "sk-test", GC_DICTIONARY_PATH: "/tmp/dict.json" },
      "/Users/me",
    );
    expect(result.ok && result.value.apiKey).toBe("sk-test");
    expect(result.ok && result.value.dictionaryPath).toBe("/tmp/dict.json");
  });

  test("reads an optional reasoning effort", () => {
    const result = loadSettings({ ...base, GC_REASONING_EFFORT: "none" }, "/Users/me");
    expect(result.ok && result.value.reasoningEffort).toBe("none");
    const unset = loadSettings(base, "/Users/me");
    expect(unset.ok && unset.value.reasoningEffort).toBeUndefined();
  });

  test("treats a blank API key as absent", () => {
    const result = loadSettings({ ...base, GC_API_KEY: "  " }, "/Users/me");
    expect(result.ok && result.value.apiKey).toBeUndefined();
  });

  test.each([
    ["missing model", { GC_BASE_URL: base.GC_BASE_URL }],
    ["missing base URL", { GC_MODEL: base.GC_MODEL }],
    ["invalid base URL", { ...base, GC_BASE_URL: "not a url" }],
    ["unknown reasoning effort", { ...base, GC_REASONING_EFFORT: "max" }],
  ])("fails with settings_invalid on %s", (_name, env) => {
    expect(loadSettings(env, "/Users/me")).toEqual({
      ok: false,
      error: { code: "settings_invalid" },
    });
  });
});
