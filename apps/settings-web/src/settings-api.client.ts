import { ApiError, type ProfileInput, ProfilesView, SettingsView } from "@gc/protocol";
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

/** Adds a profile (`id` null) or replaces one. */
export const saveProfile = (token: string, id: string | null, input: ProfileInput, base = "") =>
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
