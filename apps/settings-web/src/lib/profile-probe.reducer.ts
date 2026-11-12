import type { ModelsProbe, ModelsResult, ProfileInput, TestProbe, TestResult } from "@gc/protocol";
import type { ApiResult } from "./settings-api.client";

/** The endpoint's model list for the form. `idle`: not asked yet (or the base URL changed). */
export type ModelsState =
  | { readonly phase: "idle" }
  | { readonly phase: "loading"; readonly baseUrl: string }
  | { readonly phase: "loaded"; readonly models: readonly string[] }
  | { readonly phase: "failed"; readonly error: string; readonly status?: number | undefined };

/** The Test button's last result; cleared by any edit that changes what it tested. */
export type TestState =
  | { readonly phase: "idle" }
  | { readonly phase: "testing" }
  | { readonly phase: "passed"; readonly ms: number }
  | { readonly phase: "failed"; readonly error: string; readonly status?: number | undefined };

export type ProbeState = { readonly models: ModelsState; readonly test: TestState };

export type ProbeEvent =
  | { readonly type: "modelsLoading"; readonly baseUrl: string }
  | {
      readonly type: "modelsLoaded";
      readonly baseUrl: string;
      readonly result: ApiResult<ModelsResult>;
    }
  | { readonly type: "testing" }
  | { readonly type: "tested"; readonly result: ApiResult<TestResult> };

export const IDLE_PROBE: ProbeState = { models: { phase: "idle" }, test: { phase: "idle" } };

/** A probe's failure as the page keeps it: the core's error code, or the endpoint's. */
const failure = (result: ApiResult<ModelsResult | TestResult>) => {
  if (!result.ok) return { phase: "failed" as const, error: result.error };
  if (result.value.ok) return null;
  return { phase: "failed" as const, error: result.value.error, status: result.value.status };
};

const onModels = (state: ProbeState, result: ApiResult<ModelsResult>): ProbeState => {
  const failed = failure(result);
  if (failed) return { ...state, models: failed };
  const models = result.ok && result.value.ok ? result.value.models : [];
  return { ...state, models: { phase: "loaded", models } };
};

export const probeReducer = (state: ProbeState, event: ProbeEvent): ProbeState => {
  switch (event.type) {
    case "modelsLoading":
      return { ...state, models: { phase: "loading", baseUrl: event.baseUrl } };
    case "modelsLoaded": {
      // A list for a base URL the form no longer has is dropped.
      const current = state.models.phase === "loading" && state.models.baseUrl === event.baseUrl;
      return current ? onModels(state, event.result) : state;
    }
    case "testing":
      return { ...state, test: { phase: "testing" } };
    case "tested": {
      if (state.test.phase !== "testing") return state;
      const failed = failure(event.result);
      const ms = event.result.ok && event.result.value.ok ? event.result.value.ms : 0;
      return { ...state, test: failed ?? { phase: "passed", ms } };
    }
  }
};

/**
 * After an edit: a new base URL needs a new model list; anything but the name makes the last
 * test result stale. `key`: the API key changed.
 */
export const afterEdit = (state: ProbeState, field: keyof ProfileInput | "key"): ProbeState => {
  if (field === "name") return state;
  const test = { phase: "idle" } as const;
  if (field === "baseUrl") return { models: { phase: "idle" }, test };
  if (field === "key" && state.models.phase === "failed")
    return { models: { phase: "idle" }, test };
  return { ...state, test };
};

/**
 * What a probe sends for the form. `apiKey` as a save would send it: a typed key is used, a
 * key being removed means none, and otherwise the core uses the one saved for `id`.
 */
export const modelsProbe = (
  id: string | null,
  baseUrl: string,
  apiKey: string | null | undefined,
): ModelsProbe => ({ profileId: id, baseUrl, ...(apiKey === undefined ? {} : { apiKey }) });

export const testProbe = (
  id: string | null,
  draft: ProfileInput,
  apiKey: string | null | undefined,
): TestProbe => ({
  ...modelsProbe(id, draft.baseUrl, apiKey),
  model: draft.model,
  reasoningEffort: draft.reasoningEffort,
});
