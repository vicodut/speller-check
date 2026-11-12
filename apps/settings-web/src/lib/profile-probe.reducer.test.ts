import { describe, expect, test } from "bun:test";
import {
  afterEdit,
  IDLE_PROBE,
  modelsProbe,
  type ProbeState,
  probeReducer,
  testProbe,
} from "./profile-probe.reducer";

const URL_A = "https://a.ai/v1";
const loading = probeReducer(IDLE_PROBE, { type: "modelsLoading", baseUrl: URL_A });
const listed = (models: string[]) => ({ ok: true as const, value: { ok: true as const, models } });

describe("probeReducer: model list", () => {
  test("a list for the base URL being listed is kept", () => {
    const next = probeReducer(loading, {
      type: "modelsLoaded",
      baseUrl: URL_A,
      result: listed(["m"]),
    });
    expect(next.models).toEqual({ phase: "loaded", models: ["m"] });
  });

  test("a list for a base URL the form no longer has is dropped", () => {
    const moved = afterEdit(loading, "baseUrl");
    const next = probeReducer(moved, {
      type: "modelsLoaded",
      baseUrl: URL_A,
      result: listed(["m"]),
    });
    expect(next).toBe(moved);
  });

  test("a failure keeps the endpoint's error and status, or the core's code", () => {
    const rejected = {
      ok: true as const,
      value: { ok: false as const, error: "key_rejected" as const, status: 401 },
    };
    expect(
      probeReducer(loading, { type: "modelsLoaded", baseUrl: URL_A, result: rejected }).models,
    ).toEqual({
      phase: "failed",
      error: "key_rejected",
      status: 401,
    });
    const core = { ok: false as const, error: "auth_failed" };
    expect(
      probeReducer(loading, { type: "modelsLoaded", baseUrl: URL_A, result: core }).models,
    ).toEqual({
      phase: "failed",
      error: "auth_failed",
    });
  });
});

describe("probeReducer: test", () => {
  const testing = probeReducer(IDLE_PROBE, { type: "testing" });

  test("a pass shows the time; an edit during the test drops its result", () => {
    const passed = { ok: true as const, value: { ok: true as const, ms: 1200 } };
    expect(probeReducer(testing, { type: "tested", result: passed }).test).toEqual({
      phase: "passed",
      ms: 1200,
    });
    const edited = afterEdit(testing, "model");
    expect(probeReducer(edited, { type: "tested", result: passed })).toBe(edited);
  });
});

describe("afterEdit", () => {
  const done: ProbeState = {
    models: { phase: "failed", error: "key_rejected" },
    test: { phase: "passed", ms: 5 },
  };

  test("renaming keeps everything; other edits clear the test", () => {
    expect(afterEdit(done, "name")).toBe(done);
    expect(afterEdit(done, "model")).toEqual({ ...done, test: { phase: "idle" } });
  });

  test("a new base URL, or a new key after a failed list, lists again", () => {
    expect(afterEdit(done, "baseUrl").models).toEqual({ phase: "idle" });
    expect(afterEdit(done, "key").models).toEqual({ phase: "idle" });
    const loaded: ProbeState = { ...done, models: { phase: "loaded", models: [] } };
    expect(afterEdit(loaded, "key").models).toEqual(loaded.models);
  });
});

describe("probe requests", () => {
  test("send the key as a save would: typed, removed (null), or the saved one (absent)", () => {
    expect(modelsProbe("p1", URL_A, undefined)).toEqual({ profileId: "p1", baseUrl: URL_A });
    expect(modelsProbe(null, URL_A, "sk-1")).toEqual({
      profileId: null,
      baseUrl: URL_A,
      apiKey: "sk-1",
    });
    const draft = { name: "A", baseUrl: URL_A, model: "m", reasoningEffort: null };
    expect(testProbe("p1", draft, null)).toEqual({
      profileId: "p1",
      baseUrl: URL_A,
      apiKey: null,
      model: "m",
      reasoningEffort: null,
    });
  });
});
