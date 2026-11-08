import type { LocalModelsView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** The curated local models (LocalModels in production). */
export type LocalModelsPort = {
  view(): Promise<LocalModelsView>;
  start(id: string): Result<void, AppError>;
  cancel(): void;
  remove(id: string): Promise<Result<void, AppError>>;
};

type Reply = Result<LocalModelsView, AppError>;

const ROUTE = /^\/api\/local-models(?:\/([a-z0-9][a-z0-9._-]*)(\/download)?)?$/;

const answer = async (port: LocalModelsPort, done: Result<void, AppError>): Promise<Reply> =>
  done.ok ? ok(await port.view()) : done;

/**
 * `GET /api/local-models`; `POST /api/local-models/<id>/download` starts or resumes a download;
 * `DELETE .../<id>/download` cancels it; `DELETE .../<id>` deletes the file. Each answers with
 * the view. Null when the path isn't one of them.
 */
export const routeLocalModels = (
  request: Request,
  pathname: string,
  port: LocalModelsPort,
): Promise<Reply> | null => {
  const match = ROUTE.exec(pathname);
  if (!match) return null;
  const [, id, download] = match;
  const { method } = request;
  if (!id) return method === "GET" ? port.view().then(ok) : notAllowed();
  if (download) {
    if (method === "POST") return answer(port, port.start(id));
    if (method !== "DELETE") return notAllowed();
    port.cancel();
    return port.view().then(ok);
  }
  return method === "DELETE" ? port.remove(id).then((done) => answer(port, done)) : notAllowed();
};

const notAllowed = (): Promise<Reply> => Promise.resolve(err(appError("method_not_allowed")));
