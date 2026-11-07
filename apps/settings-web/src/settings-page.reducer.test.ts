import { describe, expect, test } from "bun:test";
import type { FeatureSettingsView } from "@gc/protocol";
import { initialState, settingsPageReducer } from "./settings-page.reducer";

const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "env", envVar: "GC_BASE_URL" },
  model: { value: "qwen3:8b", source: "env", envVar: "GC_MODEL" },
  reasoningEffort: { value: "none", source: "env", envVar: "GC_REASONING_EFFORT" },
  apiKey: { set: false, source: "unset" },
};
const view = { check: feature, rephrase: feature };

describe("settingsPageReducer", () => {
  test("starts loading", () => {
    expect(initialState).toEqual({ phase: "loading" });
  });

  test("shows the settings once loaded", () => {
    expect(settingsPageReducer(initialState, { type: "loaded", view })).toEqual({
      phase: "ready",
      view,
    });
  });

  test("shows the error when loading fails", () => {
    expect(settingsPageReducer(initialState, { type: "failed", error: "auth_failed" })).toEqual({
      phase: "error",
      error: "auth_failed",
    });
  });

  test("reloading goes back to loading", () => {
    const failed = settingsPageReducer(initialState, { type: "failed", error: "unreachable" });
    expect(settingsPageReducer(failed, { type: "reload" })).toEqual({ phase: "loading" });
  });
});
