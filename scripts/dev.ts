// Dev launcher: starts Ollama when the core points at it and it isn't running, checks the model
// is pulled, then runs `core serve`. Ctrl-C stops the core, and Ollama if this script started it.
// Prints status lines only, never text.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";

const OLLAMA_PORT = "11434";
const DEFAULT_MODEL = "qwen3:8b";
const READY_TIMEOUT_MS = 30_000;

const say = (line: string) => process.stdout.write(`[dev] ${line}\n`);

/** Env for the core: Ollama + qwen3:8b with thinking off unless the caller chose otherwise. */
const coreEnv = (): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = { ...process.env };
  env.GC_BASE_URL ||= `http://127.0.0.1:${OLLAMA_PORT}/v1`;
  if (!env.GC_MODEL) {
    env.GC_MODEL = DEFAULT_MODEL;
    // qwen3 thinks for minutes on CPU; only defaulted together with the model it's tuned for.
    env.GC_REASONING_EFFORT ||= "none";
  }
  return env;
};

const isLocalOllama = (baseUrl: string): boolean => {
  const url = new URL(baseUrl);
  return ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === OLLAMA_PORT;
};

/** Model names Ollama has pulled, or null when it isn't answering. */
const pulledModels = async (origin: string): Promise<string[] | null> => {
  try {
    const response = await fetch(`${origin}/api/tags`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    const body = (await response.json()) as { models?: { name?: string }[] };
    return (body.models ?? []).flatMap((m) => (m.name ? [m.name] : []));
  } catch {
    return null;
  }
};

const findOllama = (): string | null => {
  const local = join(homedir(), ".local/bin/ollama");
  return Bun.which("ollama") ?? (existsSync(local) ? local : null);
};

const waitForOllama = async (origin: string): Promise<string[] | null> => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const models = await pulledModels(origin);
    if (models) return models;
    await Bun.sleep(500);
  }
  return null;
};

/** Makes sure Ollama answers; returns the process if this script had to start it. */
const ensureOllama = async (
  origin: string,
): Promise<{ started: Subprocess | null; models: string[] } | null> => {
  const running = await pulledModels(origin);
  if (running) {
    say("Ollama already running");
    return { started: null, models: running };
  }
  const binary = findOllama();
  if (!binary) {
    say("Ollama isn't running and wasn't found. Install it, or start your model server.");
    return null;
  }
  say("starting Ollama");
  const started = Bun.spawn([binary, "serve"], { stdout: "ignore", stderr: "ignore" });
  const models = await waitForOllama(origin);
  if (!models) {
    started.kill();
    say("Ollama didn't answer within 30 s");
    return null;
  }
  return { started, models };
};

const run = async (): Promise<number> => {
  const env = coreEnv();
  const baseUrl = env.GC_BASE_URL ?? "";
  let ollama: Subprocess | null = null;
  if (isLocalOllama(baseUrl)) {
    const ready = await ensureOllama(new URL(baseUrl).origin);
    if (!ready) return 1;
    ollama = ready.started;
    if (!ready.models.includes(env.GC_MODEL ?? "")) {
      say(`model ${env.GC_MODEL} isn't pulled. Run: ollama pull ${env.GC_MODEL}`);
      ollama?.kill();
      return 1;
    }
  }
  say(`core: ${env.GC_MODEL} at ${baseUrl}. Ctrl-C stops everything.`);
  const core = Bun.spawn(["bun", "run", "--cwd", "apps/core", "cli", "serve"], {
    env,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const stop = () => core.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const code = await core.exited;
  if (ollama) {
    say("stopping Ollama");
    ollama.kill();
    await ollama.exited;
  }
  return code;
};

process.exitCode = await run();
