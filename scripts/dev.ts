// Dev launcher: starts Ollama if it's installed and not running (so switching to a local profile
// in the settings page works mid-session), checks the model in use is pulled when it's on Ollama,
// builds the settings page, then runs `core serve`. Ctrl-C stops the core, and Ollama if this
// script started it. Until the core manages the local runtime itself (#39, #41).
// Prints status lines only, never text.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";

const OLLAMA_PORT = "11434";
const DEFAULT_MODEL = "qwen3:8b";
const READY_TIMEOUT_MS = 30_000;

const say = (line: string) => process.stdout.write(`[dev] ${line}\n`);

type ModelInUse = { baseUrl: string; model: string };

const settingsPath = (env: NodeJS.ProcessEnv): string =>
  env.GC_SETTINGS_PATH ||
  join(homedir(), "Library", "Application Support", "GrammarChecker", "settings.json");

/**
 * The model the core will start with: the GC_* env vars when set (they override profiles),
 * else the active saved profile, else the first-run Local profile (Ollama + qwen3:8b).
 */
const modelInUse = async (env: NodeJS.ProcessEnv): Promise<ModelInUse> => {
  if (env.GC_BASE_URL || env.GC_MODEL) {
    return { baseUrl: env.GC_BASE_URL ?? "", model: env.GC_MODEL ?? "" };
  }
  try {
    const file = (await Bun.file(settingsPath(env)).json()) as {
      activeProfileId?: string;
      profiles?: { id?: string; baseUrl?: string; model?: string }[];
    };
    const active = file.profiles?.find((p) => p.id === file.activeProfileId);
    if (active?.baseUrl && active.model) return { baseUrl: active.baseUrl, model: active.model };
  } catch {
    // No settings file yet: the core creates the Local profile on first run.
  }
  return { baseUrl: `http://127.0.0.1:${OLLAMA_PORT}/v1`, model: DEFAULT_MODEL };
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

/**
 * Ollama for the session. Required (and the model pulled) when the model in use is on it;
 * otherwise started anyway if installed, so a later switch to a local profile finds it.
 * Undefined means "stop": a required Ollama couldn't be used.
 */
const startOllama = async (
  baseUrl: string,
  model: string,
): Promise<Subprocess | null | undefined> => {
  if (!isLocalOllama(baseUrl)) {
    if (!findOllama()) return null;
    return (await ensureOllama(`http://127.0.0.1:${OLLAMA_PORT}`))?.started ?? null;
  }
  const ready = await ensureOllama(new URL(baseUrl).origin);
  if (!ready) return undefined;
  if (!ready.models.includes(model)) {
    say(`model ${model} isn't pulled. Run: ollama pull ${model}`);
    ready.started?.kill();
    return undefined;
  }
  return ready.started;
};

const run = async (): Promise<number> => {
  const { baseUrl, model } = await modelInUse(process.env);
  const ollama = await startOllama(baseUrl, model);
  if (ollama === undefined) return 1;
  // The core serves the built settings page at /settings; a build takes well under a second.
  const page = Bun.spawnSync(["bun", "run", "--cwd", "apps/settings-web", "build"]);
  if (page.exitCode !== 0) say("settings page didn't build; /settings will answer 404");
  say(`core: ${model} at ${baseUrl}. Settings: bun run settings. Ctrl-C stops everything.`);
  const core = Bun.spawn(["bun", "run", "--cwd", "apps/core", "cli", "serve"], {
    env: process.env,
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
