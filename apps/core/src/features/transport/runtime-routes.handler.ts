import { PullRequest, type RuntimeView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** The local runtime (Ollama), as `core serve` runs it. */
export type RuntimePort = {
  view(): Promise<RuntimeView>;
  ensureRunning(): Promise<void>;
  /** Starts pulling a model in the background; the view then reports its progress. */
  pull(model: string): Promise<Result<void, AppError>>;
  cancelPull(): void;
};

type Reply = Result<RuntimeView, AppError>;

const START = "/api/runtime/ollama/start";
const PULL = "/api/runtime/ollama/pull";

const startPull = async (request: Request, port: RuntimePort): Promise<Reply> => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = PullRequest.safeParse(body);
  if (!parsed.success) return err(appError("body_invalid"));
  const started = await port.pull(parsed.data.model);
  return started.ok ? ok(await port.view()) : started;
};

/**
 * `GET /api/runtime`; `POST .../ollama/start` starts Ollama; `POST .../ollama/pull {model}`
 * starts a pull and `DELETE .../ollama/pull` cancels it. Each answers with the runtime view.
 * Null when the path isn't one of them.
 */
export const routeRuntime = (
  request: Request,
  pathname: string,
  port: RuntimePort,
): Promise<Reply> | null => {
  const { method } = request;
  const notAllowed = () => Promise.resolve(err(appError("method_not_allowed")));
  if (pathname === "/api/runtime") return method === "GET" ? port.view().then(ok) : notAllowed();
  if (pathname === START) {
    if (method !== "POST") return notAllowed();
    return port.ensureRunning().then(async () => ok(await port.view()));
  }
  if (pathname !== PULL) return null;
  if (method === "POST") return startPull(request, port);
  if (method !== "DELETE") return notAllowed();
  port.cancelPull();
  return port.view().then(ok);
};
