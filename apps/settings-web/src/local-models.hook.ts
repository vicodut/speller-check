import type { LocalModelsView } from "@gc/protocol";
import { useCallback, useEffect, useState } from "react";
import { anyDownloading } from "./local-models.util";
import {
  cancelLocalModel,
  deleteLocalModel,
  downloadLocalModel,
  fetchLocalModels,
} from "./local-models-api.client";
import type { ApiResult } from "./settings-api.client";

/**
 * The curated local models: loaded once, then refreshed twice a second while one downloads.
 * `error` is the last failed action's code (for example `model_in_use`).
 */
export const useLocalModels = (token: string | null) => {
  const [view, setView] = useState<LocalModelsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    // A fresh view object each poll re-runs this effect, so polling goes on until it settles.
    if (view && !anyDownloading(view)) return;
    const timer = setTimeout(
      async () => {
        const next = await fetchLocalModels(token);
        if (next.ok) setView(next.value);
      },
      view ? 500 : 0,
    );
    return () => clearTimeout(timer);
  }, [token, view]);

  const act = useCallback(
    async (call: (token: string) => Promise<ApiResult<LocalModelsView>>) => {
      if (!token) return;
      setBusy(true);
      const result = await call(token);
      if (result.ok) setView(result.value);
      setError(result.ok ? null : result.error);
      setBusy(false);
    },
    [token],
  );

  return {
    view,
    error,
    busy,
    onDownload: (id: string) => void act((t) => downloadLocalModel(t, id)),
    onCancel: (id: string) => void act((t) => cancelLocalModel(t, id)),
    onDelete: (id: string) => void act((t) => deleteLocalModel(t, id)),
  };
};
