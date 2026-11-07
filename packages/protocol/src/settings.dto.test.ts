import { describe, expect, test } from "bun:test";
import { SettingsView } from "./settings.dto";

const feature = {
  baseUrl: { value: "https://openrouter.ai/api/v1", source: "env", envVar: "GC_BASE_URL" },
  model: { value: "qwen/qwen3.8-flash", source: "env", envVar: "GC_MODEL" },
  reasoningEffort: { value: null, source: "unset" },
  apiKey: { set: true, source: "env", envVar: "GC_API_KEY" },
};

describe("SettingsView", () => {
  test("accepts a view with a source for every field", () => {
    expect(SettingsView.safeParse({ check: feature, rephrase: feature }).success).toBe(true);
  });

  test("refuses an API key carrying a value", () => {
    const leaky = { ...feature, apiKey: { ...feature.apiKey, value: "sk-or-secret" } };
    expect(SettingsView.safeParse({ check: leaky, rephrase: feature }).success).toBe(false);
  });

  test("refuses an unknown source", () => {
    const odd = { ...feature, model: { value: "m", source: "guess" } };
    expect(SettingsView.safeParse({ check: odd, rephrase: feature }).success).toBe(false);
  });
});
