import { describe, expect, test } from "bun:test";
import { loadSettings } from "./settings.loader";
import { buildSettingsView, settingSources } from "./settings-view.builder";

const env = {
  GC_BASE_URL: "https://openrouter.ai/api/v1/",
  GC_MODEL: "qwen/qwen3.8-flash",
  GC_API_KEY: "sk-or-secret",
};

const view = (e: Record<string, string>) => {
  const settings = loadSettings(e, "/home/me");
  if (!settings.ok) throw new Error("fixture settings invalid");
  return buildSettingsView(e, settings.value);
};

describe("buildSettingsView", () => {
  test("names the env var behind each value set from the environment", () => {
    const { check } = view(env);
    expect(check.baseUrl).toEqual({
      value: "https://openrouter.ai/api/v1",
      source: "env",
      envVar: "GC_BASE_URL",
    });
    expect(check.model).toEqual({ value: "qwen/qwen3.8-flash", source: "env", envVar: "GC_MODEL" });
  });

  test("says a key is set without ever carrying it", () => {
    const { check } = view(env);
    expect(check.apiKey).toEqual({ set: true, source: "env", envVar: "GC_API_KEY" });
    expect(JSON.stringify(view(env))).not.toContain("sk-or-secret");
  });

  test("marks what nothing sets as unset", () => {
    const { check } = view({ GC_BASE_URL: env.GC_BASE_URL, GC_MODEL: env.GC_MODEL });
    expect(check.apiKey).toEqual({ set: false, source: "unset" });
    expect(check.reasoningEffort).toEqual({ value: null, source: "unset" });
  });

  test("a blank env var counts as unset", () => {
    const { check } = view({ ...env, GC_API_KEY: "  ", GC_REASONING_EFFORT: "" });
    expect(check.apiKey.source).toBe("unset");
    expect(check.reasoningEffort.source).toBe("unset");
  });

  test("check and rephrase share one setup for now", () => {
    const v = view({ ...env, GC_REASONING_EFFORT: "none" });
    expect(v.rephrase).toEqual(v.check);
    expect(v.check.reasoningEffort).toEqual({
      value: "none",
      source: "env",
      envVar: "GC_REASONING_EFFORT",
    });
  });
});

describe("settingSources", () => {
  test("keeps only the source of each setting, for logging", () => {
    expect(settingSources(view(env).check)).toEqual({
      baseUrl: "env",
      model: "env",
      apiKey: "env",
      reasoningEffort: "unset",
    });
  });
});
