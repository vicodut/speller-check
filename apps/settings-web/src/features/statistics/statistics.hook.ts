import type { StatisticsView } from "@gc/protocol";
import { useEffect, useState } from "react";
import { type ApiResult, fetchStatistics } from "../../lib/settings-api.client";

/** The statistics, read once when the page opens (a page reload shows newer numbers). */
export const useStatistics = (token: string): ApiResult<StatisticsView> | null => {
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

  return result;
};
