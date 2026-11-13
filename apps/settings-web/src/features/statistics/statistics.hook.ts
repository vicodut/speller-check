import type { StatisticsView } from "@gc/protocol";
import { useCallback, useEffect, useState } from "react";
import { type ApiResult, clearStatistics, fetchStatistics } from "../../lib/settings-api.client";

/**
 * The statistics, read once when the page opens (a page reload shows newer numbers), and
 * `clear`, which forgets them all and shows the answered (empty) view.
 */
export const useStatistics = (token: string) => {
  const [result, setResult] = useState<ApiResult<StatisticsView> | null>(null);

  useEffect(() => {
    let current = true;
    void fetchStatistics(token).then((next) => {
      if (current) setResult(next);
    });
    return () => {
      current = false;
    };
  }, [token]);

  const clear = useCallback(async (): Promise<ApiResult<StatisticsView>> => {
    const next = await clearStatistics(token);
    if (next.ok) setResult(next);
    return next;
  }, [token]);

  return { result, clear };
};
