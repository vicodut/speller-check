import type { OllamaPullView } from "@gc/protocol";
import { type AppError, appError, type ErrorCode } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { OllamaClient } from "./ollama.client";
import { applyPullLine, INITIAL_PROGRESS, type PullProgress } from "./pull-progress.util";

/** One pull, updated in place as its lines stream in. */
type Pull = {
  readonly model: string;
  readonly abort: AbortController;
  readonly settled: Promise<void>;
  progress: PullProgress;
  error: ErrorCode | null;
  running: boolean;
};

/**
 * Pulls models through Ollama, one at a time, and keeps the latest pull's progress for the page
 * to poll. A finished or failed pull stays visible until the next one; a cancelled one is
 * forgotten. Never deletes a model: Ollama keeps the layers of a cancelled pull.
 */
export class OllamaPuller {
  private current: Pull | null = null;

  constructor(
    private readonly client: Pick<OllamaClient, "status" | "pull">,
    private readonly logger: Logger,
  ) {}

  /** Starts pulling in the background; answers once it has started (not when it ends). */
  async start(model: string): Promise<Result<void, AppError>> {
    if (this.current?.running) return err(appError("pull_in_progress"));
    if (!(await this.client.status())) return err(appError("ollama_unreachable"));
    // Checked again: another start may have begun while Ollama was asked.
    if (this.current?.running) return err(appError("pull_in_progress"));
    const abort = new AbortController();
    let settle = () => {};
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const pull: Pull = {
      model,
      abort,
      settled,
      progress: INITIAL_PROGRESS,
      error: null,
      running: true,
    };
    this.current = pull;
    this.logger.info({ event: "ollama.pull_started" });
    void this.run(pull).finally(settle);
    return ok(undefined);
  }

  /** Cancels the running pull, if any; the page then shows no pull. */
  cancel(): void {
    const pull = this.current;
    if (!pull?.running) return;
    this.current = null;
    pull.abort.abort();
  }

  view(): OllamaPullView | null {
    const pull = this.current;
    if (!pull) return null;
    const { step, completed, total } = pull.progress;
    return {
      model: pull.model,
      step: pull.error ? "failed" : step,
      completed,
      total,
      error: pull.error,
    };
  }

  /** Resolves once the current pull (if any) has ended; for shutdown and tests. */
  whenSettled(): Promise<void> {
    return this.current?.settled ?? Promise.resolve();
  }

  private async run(pull: Pull): Promise<void> {
    const started = Date.now();
    const result = await this.client.pull(pull.model, pull.abort.signal, (line) => {
      pull.progress = applyPullLine(pull.progress, line);
    });
    pull.running = false;
    if (result.ok) {
      pull.progress = { ...pull.progress, step: "done" };
      this.logger.info({ event: "ollama.pull_done", ms: Date.now() - started });
    } else if (pull.abort.signal.aborted) {
      this.logger.info({ event: "ollama.pull_cancelled", ms: Date.now() - started });
    } else {
      pull.error = result.error.code;
      this.logger.error({ event: "ollama.pull_failed", code: result.error.code });
    }
  }
}
