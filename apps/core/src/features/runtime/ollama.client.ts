import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { ndjsonLines } from "./ndjson-lines.util";
import { type PullLine, parsePullLine } from "./pull-progress.util";

/** What Ollama reports when it answers. */
export type OllamaStatus = { readonly version: string; readonly models: readonly string[] };

const TIMEOUT_MS = 1_000;

/**
 * Ollama's error text is never shown or logged, only mapped to a code: an unknown model reads
 * "pull model manifest: file does not exist" (or "… not found" in some versions).
 */
const pullError = (message: unknown): AppError =>
  appError(
    typeof message === "string" && /not found|does not exist/i.test(message)
      ? "ollama_model_not_found"
      : "ollama_pull_failed",
  );

/**
 * Ollama's own HTTP API (not the OpenAI-compatible one): its version and pulled models, and
 * pulling a model. Status is null when it doesn't answer, which is how "not running" is detected.
 */
export class OllamaClient {
  constructor(
    readonly origin = "http://127.0.0.1:11434",
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async status(): Promise<OllamaStatus | null> {
    try {
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      const [version, tags] = await Promise.all([
        this.fetchFn(`${this.origin}/api/version`, { signal }),
        this.fetchFn(`${this.origin}/api/tags`, { signal }),
      ]);
      if (!version.ok || !tags.ok) return null;
      const v = (await version.json()) as { version?: unknown };
      const t = (await tags.json()) as { models?: { name?: unknown }[] };
      return {
        version: typeof v.version === "string" ? v.version : "unknown",
        models: (t.models ?? []).flatMap((m) => (typeof m.name === "string" ? [m.name] : [])),
      };
    } catch {
      return null;
    }
  }

  /**
   * Pulls a model through `POST /api/pull`, handing each status line to `onLine` as it streams.
   * Ok once Ollama says `success`. Aborting `signal` cancels the pull (Ollama keeps the layers
   * it has, so a later pull resumes).
   */
  async pull(
    model: string,
    signal: AbortSignal,
    onLine: (line: PullLine) => void,
  ): Promise<Result<void, AppError>> {
    try {
      const response = await this.fetchFn(`${this.origin}/api/pull`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, stream: true }),
        signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: unknown };
        return err(pullError(body.error));
      }
      return await this.follow(response.body, onLine);
    } catch {
      return err(appError(signal.aborted ? "ollama_pull_cancelled" : "ollama_unreachable"));
    }
  }

  private async follow(
    body: ReadableStream<Uint8Array>,
    onLine: (line: PullLine) => void,
  ): Promise<Result<void, AppError>> {
    for await (const text of ndjsonLines(body)) {
      const line = parsePullLine(text);
      if (!line) continue;
      if ("error" in line) return err(pullError(line.error));
      onLine(line);
      if (line.status === "success") return ok(undefined);
    }
    return err(appError("ollama_pull_failed"));
  }
}
