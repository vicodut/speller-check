import { ApiError, SettingsView } from "@gc/protocol";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Reads the settings in effect. `base` is "" on the page (same origin); tests pass a server URL.
 * Errors are codes: the core's own (`auth_failed`, …), `unreachable`, or `bad_response`.
 */
export const fetchSettings = async (
  token: string,
  base = "",
  fetchFn: typeof fetch = fetch,
): Promise<ApiResult<SettingsView>> => {
  let response: Response;
  try {
    response = await fetchFn(`${base}/api/settings`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, error: "unreachable" };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = ApiError.safeParse(body);
    return { ok: false, error: error.success ? error.data.error : `http_${response.status}` };
  }
  const view = SettingsView.safeParse(body);
  return view.success ? { ok: true, value: view.data } : { ok: false, error: "bad_response" };
};
