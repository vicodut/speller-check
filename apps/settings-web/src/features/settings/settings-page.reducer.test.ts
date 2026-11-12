import { describe, expect, test } from "bun:test";
import type { FeatureSettingsView, ProfilesView, RuntimeView } from "@gc/protocol";
import { keyChange } from "../../lib/settings-page.model";
import { initialState, type SettingsPageState, settingsPageReducer } from "./settings-page.reducer";

const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "saved" },
  model: { value: "qwen3:8b", source: "saved" },
  reasoningEffort: { value: "none", source: "saved" },
  apiKey: { set: false, source: "unset" },
};
const view = { check: feature, rephrase: feature };
const local = {
  id: "p1",
  name: "Local",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "qwen3:8b",
  reasoningEffort: "none" as const,
  local: true,
  builtIn: true,
  hasKey: false,
};
const profiles: ProfilesView = {
  profiles: [local],
  features: { check: null, rephrase: null },
  activeProfileId: "p1",
  lockedByEnv: false,
};
const draft = { name: "Cloud", baseUrl: "https://x.ai/v1", model: "m", reasoningEffort: null };

const runtime: RuntimeView = {
  ollama: {
    state: "starting",
    version: null,
    models: [],
    inUse: true,
    startedByApp: true,
    pull: null,
  },
};
const ready = settingsPageReducer(initialState, { type: "loaded", view, profiles, runtime });

describe("settingsPageReducer", () => {
  test("starts loading, then shows the settings and profiles", () => {
    expect(initialState).toEqual({ phase: "loading" });
    expect(ready).toEqual({
      phase: "ready",
      view,
      profiles,
      runtime,
      form: null,
      busy: false,
      notice: null,
    });
  });

  test("a load failure shows its error; reload goes back to loading", () => {
    const failed = settingsPageReducer(initialState, { type: "failed", error: "auth_failed" });
    expect(failed).toEqual({ phase: "error", error: "auth_failed" });
    expect(settingsPageReducer(failed, { type: "reload" })).toEqual({ phase: "loading" });
  });

  test("adding opens an empty-id form from a preset; editing opens one with the profile", () => {
    const adding = settingsPageReducer(ready, { type: "add", input: draft });
    expect(adding).toMatchObject({ form: { id: null, draft } });
    const editing = settingsPageReducer(ready, { type: "edit", id: "p1" });
    expect(editing).toMatchObject({
      form: { id: "p1", draft: { name: "Local", model: "qwen3:8b", reasoningEffort: "none" } },
    });
  });

  test("typing changes the draft; cancel closes the form", () => {
    const adding = settingsPageReducer(ready, { type: "add", input: draft });
    const typed = settingsPageReducer(adding, { type: "draft", field: "model", value: "other" });
    expect(typed).toMatchObject({ form: { draft: { model: "other" } } });
    expect(settingsPageReducer(typed, { type: "cancel" })).toMatchObject({ form: null });
  });

  test("an action marks busy; its result replaces the data and closes the form", () => {
    const adding = settingsPageReducer(ready, { type: "add", input: draft });
    const busy = settingsPageReducer(adding, { type: "working" });
    expect(busy).toMatchObject({ busy: true, notice: null });
    const done = settingsPageReducer(busy, { type: "loaded", view, profiles, runtime });
    expect(done).toMatchObject({ busy: false, form: null });
  });

  test("an action failure keeps the form and shows the error code", () => {
    const adding = settingsPageReducer(ready, { type: "add", input: draft });
    const failed = settingsPageReducer(adding, { type: "actionFailed", error: "body_invalid" });
    expect(failed).toMatchObject({ busy: false, notice: "body_invalid", form: { id: null } });
  });

  test("events that need loaded data are ignored while loading", () => {
    const loading: SettingsPageState = initialState;
    expect(settingsPageReducer(loading, { type: "edit", id: "p1" })).toBe(loading);
  });

  test("a typed key is kept apart from the draft; removing a saved key is a separate choice", () => {
    const editing = settingsPageReducer(ready, { type: "edit", id: "p1" });
    expect(editing).toMatchObject({ form: { key: { typed: "", remove: false, saved: false } } });
    const typed = settingsPageReducer(editing, { type: "key", typed: "sk-1" });
    expect(typed).toMatchObject({ form: { key: { typed: "sk-1" } } });
    const removing = settingsPageReducer(typed, { type: "removeKey", remove: true });
    expect(removing).toMatchObject({ form: { key: { typed: "", remove: true } } });
  });

  test("keyChange: typed sets, remove removes, nothing keeps", () => {
    expect(keyChange({ typed: " sk-1 ", remove: false, saved: true })).toBe("sk-1");
    expect(keyChange({ typed: "", remove: true, saved: true })).toBeNull();
    expect(keyChange({ typed: "", remove: false, saved: true })).toBeUndefined();
  });

  test("a runtime refresh replaces only the runtime", () => {
    const running = {
      ollama: { ...runtime.ollama, state: "running" as const, version: "0.40.13" },
    };
    const next = settingsPageReducer(ready, { type: "runtime", runtime: running });
    expect(next).toEqual({ ...ready, runtime: running } as SettingsPageState);
  });

  test("a pull or cancel answering shows its runtime and keeps the open form", () => {
    const pulling: RuntimeView = {
      ollama: {
        ...runtime.ollama,
        state: "running",
        pull: { model: "smollm2:135m", step: "starting", completed: 0, total: 0, error: null },
      },
    };
    const editing = settingsPageReducer(ready, { type: "edit", id: "p1" });
    const working = settingsPageReducer(editing, { type: "working" });
    const next = settingsPageReducer(working, { type: "runtimeChanged", runtime: pulling });
    expect(next).toMatchObject({ runtime: pulling, busy: false, notice: null });
    expect(next).toHaveProperty("form.id", "p1");
  });
});
