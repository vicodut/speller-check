import type { OllamaState, RuntimeView } from "@gc/protocol";
import type { Logger } from "../../shared/logger";
import type { OllamaClient } from "./ollama.client";
import type { OllamaLauncher, RunningProcess } from "./ollama-process.runner";

/** Only the base URL matters: whether the model is served by Ollama on this Mac. */
type ModelEndpoint = { readonly baseUrl: string };
type Options = { readonly pollMs: number; readonly timeoutMs: number };

const OLLAMA_PORT = "11434";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Whether a base URL points at Ollama on its default port on this Mac. */
export const isOllamaUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTS.has(parsed.hostname) && parsed.port === OLLAMA_PORT;
  } catch {
    return false;
  }
};

/** Why Ollama isn't answering, as far as this app knows. */
type Phase = "idle" | "starting" | "not_installed" | "failed";

/**
 * Keeps Ollama running while the model in use is on it: starts `ollama serve` if it isn't
 * answering, and stops it again on a switch away (or on quit), but only if this app started it.
 * An Ollama the user runs is used as is and never stopped.
 */
export class OllamaRuntime {
  private process: RunningProcess | null = null;
  private starting: Promise<void> | null = null;
  private phase: Phase = "idle";
  /** The model in use is on Ollama. */
  private wanted = false;

  constructor(
    private readonly client: Pick<OllamaClient, "status">,
    private readonly launcher: OllamaLauncher,
    private readonly logger: Logger,
    private readonly options: Options = { pollMs: 500, timeoutMs: 30_000 },
  ) {}

  /** Called with each model put in use (at launch and on every switch). */
  async use(model: ModelEndpoint): Promise<void> {
    this.wanted = isOllamaUrl(model.baseUrl);
    if (this.wanted) return this.ensureRunning();
    await this.starting;
    this.stop();
  }

  /** Starts Ollama if it isn't answering; concurrent calls share one attempt. */
  ensureRunning(): Promise<void> {
    // "starting" at once, so a page reading the view right after a switch sees it.
    if (!this.starting) this.phase = "starting";
    this.starting ??= this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Stops the Ollama this app started, if any (switch to cloud, or quit). */
  stop(): void {
    if (!this.process) return;
    this.process.kill();
    this.process = null;
    this.phase = "idle";
    this.logger.info({ event: "ollama.stopped" });
  }

  async view(): Promise<RuntimeView> {
    const status = await this.client.status();
    const state: OllamaState = status
      ? "running"
      : this.phase === "idle"
        ? "not_running"
        : this.phase;
    return {
      ollama: {
        state,
        version: status?.version ?? null,
        models: [...(status?.models ?? [])],
        inUse: this.wanted,
        startedByApp: this.process !== null,
      },
    };
  }

  private async start(): Promise<void> {
    if (await this.client.status()) {
      this.phase = "idle";
      return;
    }
    const binary = this.launcher.find();
    if (!binary) {
      this.phase = "not_installed";
      this.logger.info({ event: "ollama.not_installed" });
      return;
    }
    this.process?.kill();
    this.phase = "starting";
    this.logger.info({ event: "ollama.starting" });
    const started = Date.now();
    const child = this.launcher.start(binary);
    this.process = child;
    void child.exited.then(() => {
      if (this.process === child) this.process = null;
    });
    await this.settle(child, started);
    if (!this.wanted) this.stop();
  }

  private async settle(child: RunningProcess, started: number): Promise<void> {
    if (await this.answers()) {
      this.phase = "idle";
      this.logger.info({ event: "ollama.started", ms: Date.now() - started });
      return;
    }
    child.kill();
    if (this.process === child) this.process = null;
    this.phase = "failed";
    this.logger.error({ event: "ollama.start_failed", code: "ollama_unreachable" });
  }

  private async answers(): Promise<boolean> {
    const deadline = Date.now() + this.options.timeoutMs;
    while (Date.now() < deadline) {
      if (await this.client.status()) return true;
      await Bun.sleep(this.options.pollMs);
    }
    return false;
  }
}
