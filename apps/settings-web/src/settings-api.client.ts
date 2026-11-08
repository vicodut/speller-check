import {
  ApiError,
  type FeatureProfiles,
  type ModelsProbe,
  ModelsResult,
  type ProfileSave,
  ProfilesView,
  RuntimeView,
  SettingsView,
  type TestProbe,
  TestResult,
  TokenView,
} from "@gc/protocol";
import type { z } from "zod";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

type Call = {
  readonly token: string;
  readonly path: string;
  readonly method?: string;
  readonly body?: unknown;
  /** "" on the page (same origin); tests pass a server URL. */
  readonly base?: string;
  readonly fetchFn?: typeof fetch;
};

/**
 * One API call. Errors are codes: the core's own (`auth_failed`, …), `unreachable`, or
 * `bad_response` when the body doesn't match the schema.
 */
const call = async <T>(schema: z.ZodType<T>, c: Call): Promise<ApiResult<T>> => {
  let response: Response;
  try {
    response = await (c.fetchFn ?? fetch)(`${c.base ?? ""}${c.path}`, {
      method: c.method ?? "GET",
      headers: {
        authorization: `Bearer ${c.token}`,
        ...(c.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(c.body === undefined ? {} : { body: JSON.stringify(c.body) }),
    });
  } catch {
    return { ok: false, error: "unreachable" };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = ApiError.safeParse(body);
    return { ok: false, error: error.success ? error.data.error : `http_${response.status}` };
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "bad_response" };
};

/** Reads the settings in effect. */
export const fetchSettings = (token: string, base = "", fetchFn: typeof fetch = fetch) =>
  call(SettingsView, { token, path: "/api/settings", base, fetchFn });

export const fetchProfiles = (token: string, base = "") =>
  call(ProfilesView, { token, path: "/api/profiles", base });

const profilePath = (id: string) => `/api/profiles/${encodeURIComponent(id)}`;

/** Adds a profile (`id` null) or replaces one; `input.apiKey` sets, removes or keeps its key. */
export const saveProfile = (token: string, id: string | null, input: ProfileSave, base = "") =>
  call(ProfilesView, {
    token,
    path: id === null ? "/api/profiles" : profilePath(id),
    method: id === null ? "POST" : "PUT",
    body: input,
    base,
  });

export const deleteProfile = (token: string, id: string, base = "") =>
  call(ProfilesView, { token, path: profilePath(id), method: "DELETE", base });

export const activateProfile = (token: string, id: string, base = "") =>
  call(ProfilesView, { token, path: `${profilePath(id)}/activate`, method: "POST", base });

/** Maps Check and Rephrase to profiles (null: same as active). */
export const setFeatureProfiles = (token: string, features: FeatureProfiles, base = "") =>
  call(ProfilesView, {
    token,
    path: "/api/profiles/features",
    method: "PUT",
    body: features,
    base,
  });

/**
 * Deletes a profile in use by first moving its uses to Local: activate it if the profile was the
 * active one, then remap the features that used it. Stops at the first refusal.
 */
export const deleteMovingToLocal = async (
  token: string,
  id: string,
  plan: { activate: string | null; features: FeatureProfiles | null },
  base = "",
): Promise<ApiResult<ProfilesView>> => {
  if (plan.activate) {
    const activated = await activateProfile(token, plan.activate, base);
    if (!activated.ok) return activated;
  }
  if (plan.features) {
    const remapped = await setFeatureProfiles(token, plan.features, base);
    if (!remapped.ok) return remapped;
  }
  return deleteProfile(token, id, base);
};

/** Ollama's state, version and pulled models. */
export const fetchRuntime = (token: string, base = "") =>
  call(RuntimeView, { token, path: "/api/runtime", base });

/** Starts Ollama if it isn't running; answers once it does (or gave up). */
export const startOllama = (token: string, base = "") =>
  call(RuntimeView, { token, path: "/api/runtime/ollama/start", method: "POST", base });

/** Lists a profile's models (saved or not) from its endpoint's `/models`. */
export const listModels = (token: string, probe: ModelsProbe, base = "") =>
  call(ModelsResult, { token, path: "/api/probe/models", method: "POST", body: probe, base });

/** Sends one short request with a profile (saved or not): ok with its time, or an error code. */
export const testProfile = (token: string, probe: TestProbe, base = "") =>
  call(TestResult, { token, path: "/api/probe/test", method: "POST", body: probe, base });

const PULL_PATH = "/api/runtime/ollama/pull";

/** Starts pulling a model through Ollama; answers at once, with the pull's first progress. */
export const pullModel = (token: string, model: string, base = "") =>
  call(RuntimeView, { token, path: PULL_PATH, method: "POST", body: { model }, base });

/** Cancels the running pull; Ollama keeps what it downloaded, so a later pull resumes. */
export const cancelPull = (token: string, base = "") =>
  call(RuntimeView, { token, path: PULL_PATH, method: "DELETE", base });

/** Replaces the install token; `token` stops working once this answers. */
export const rotateToken = (token: string, base = "") =>
  call(TokenView, { token, path: "/api/token/rotate", method: "POST", base });
