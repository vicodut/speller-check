import type { StatisticsView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** What the statistics route needs (the StatisticsService in production). */
export type StatisticsPort = {
  view(): StatisticsView;
  clear(): Promise<Result<StatisticsView, AppError>>;
};

type Reply = Result<StatisticsView, AppError>;

/**
 * `/api/statistics`: GET answers every row; DELETE forgets them all. Null when the path isn't
 * this route; `method_not_allowed` for any other method.
 */
export const routeStatistics = (
  request: Request,
  pathname: string,
  port: StatisticsPort,
): Promise<Reply> | null => {
  if (pathname !== "/api/statistics") return null;
  if (request.method === "GET") return Promise.resolve(ok(port.view()));
  if (request.method === "DELETE") return port.clear();
  return Promise.resolve(err(appError("method_not_allowed")));
};
