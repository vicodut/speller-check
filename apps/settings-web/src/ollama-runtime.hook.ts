import type { RuntimeView } from "@gc/protocol";
import { type Dispatch, useEffect } from "react";
import { isPulling } from "./pull-progress.util";
import { type ApiResult, cancelPull, fetchRuntime, pullModel } from "./settings-api.client";
import type { SettingsPageEvent } from "./settings-page.reducer";

/**
 * Follows Ollama while it starts (after a switch to a local profile) or pulls a model: refreshes
 * the runtime every second, or twice a second during a pull. Keyed on the runtime object: each
 * refresh is a new one, so polling goes on until it settles. Returns the pull actions.
 */
export const useOllamaRuntime = (
  runtime: RuntimeView | null,
  token: string | null,
  dispatch: Dispatch<SettingsPageEvent>,
) => {
  useEffect(() => {
    const pulling = isPulling(runtime?.ollama.pull ?? null);
    if ((runtime?.ollama.state !== "starting" && !pulling) || !token) return;
    const timer = setTimeout(
      async () => {
        const next = await fetchRuntime(token);
        if (next.ok) dispatch({ type: "runtime", runtime: next.value });
      },
      pulling ? 500 : 1000,
    );
    return () => clearTimeout(timer);
  }, [runtime, token, dispatch]);

  /** The reply carries the runtime with the pull's first progress; polling follows it. */
  const act = async (call: (token: string) => Promise<ApiResult<RuntimeView>>) => {
    if (!token) return;
    dispatch({ type: "working" });
    const result = await call(token);
    dispatch(
      result.ok
        ? { type: "runtimeChanged", runtime: result.value }
        : { type: "actionFailed", error: result.error },
    );
  };
  return {
    onPull: (model: string) => void act((t) => pullModel(t, model)),
    onCancelPull: () => void act(cancelPull),
  };
};
