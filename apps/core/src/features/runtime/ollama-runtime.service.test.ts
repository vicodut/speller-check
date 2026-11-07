import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err } from "../../shared/result";
import type { OllamaStatus } from "./ollama.client";
import type { OllamaLauncher } from "./ollama-process.runner";
import { OllamaRuntime } from "./ollama-runtime.service";

const LOCAL = { baseUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b" };
const LOCALHOST = { baseUrl: "http://localhost:11434/v1", model: "qwen3:8b" };
const LM_STUDIO = { baseUrl: "http://127.0.0.1:1234/v1", model: "m" };
const CLOUD = { baseUrl: "https://openrouter.ai/api/v1", model: "qwen/qwen3.8-flash" };
const UP: OllamaStatus = { version: "0.40.13", models: ["qwen3:8b"] };
/** Pulls are covered by ollama-pull.service.test.ts; here one only needs to exist. */
const pull = async () => err(appError("ollama_unreachable"));

/** Ollama is up when `up` is true; starting it brings it up after `answersAfter` polls. */
const setup = (opts: { up?: boolean; installed?: boolean; answersAfter?: number } = {}) => {
  const world = { up: opts.up ?? false, starts: 0, kills: 0, polls: 0, logs: [] as string[] };
  /** A started process that wasn't killed: only it can come up. */
  let alive = false;
  const client = {
    status: async () => {
      if (alive && !world.up) {
        world.polls++;
        if (world.polls > (opts.answersAfter ?? 1)) world.up = true;
      }
      return world.up ? UP : null;
    },
    pull,
  };
  const launcher: OllamaLauncher = {
    find: () => (opts.installed === false ? null : "/bin/ollama"),
    start: () => {
      world.starts++;
      alive = true;
      return {
        kill: () => {
          world.kills++;
          world.up = false;
          alive = false;
        },
        exited: new Promise(() => {}),
      };
    },
  };
  const logger = new Logger((line) => world.logs.push(JSON.parse(line).event));
  const runtime = new OllamaRuntime(client, launcher, logger, { pollMs: 0, timeoutMs: 1_000 });
  return { runtime, world };
};

describe("OllamaRuntime", () => {
  test("a local Ollama model starts Ollama when it isn't running, and reports it", async () => {
    const { runtime, world } = setup();
    await runtime.use(LOCAL);
    expect(world.starts).toBe(1);
    expect(await runtime.view()).toEqual({
      ollama: {
        state: "running",
        version: "0.40.13",
        models: ["qwen3:8b"],
        inUse: true,
        startedByApp: true,
        pull: null,
      },
    });
    expect(world.logs).toEqual(["ollama.starting", "ollama.started"]);
  });

  test("an Ollama already running is used as is, and never stopped", async () => {
    const { runtime, world } = setup({ up: true });
    await runtime.use(LOCALHOST);
    await runtime.use(CLOUD);
    expect([world.starts, world.kills]).toEqual([0, 0]);
    expect((await runtime.view()).ollama).toMatchObject({
      state: "running",
      inUse: false,
      startedByApp: false,
    });
  });

  test("switching to cloud stops the Ollama this app started", async () => {
    const { runtime, world } = setup();
    await runtime.use(LOCAL);
    await runtime.use(CLOUD);
    expect(world.kills).toBe(1);
    expect((await runtime.view()).ollama).toMatchObject({ state: "not_running", inUse: false });
  });

  test("other local servers and cloud models never start Ollama", async () => {
    const { runtime, world } = setup();
    await runtime.use(LM_STUDIO);
    await runtime.use(CLOUD);
    expect(world.starts).toBe(0);
  });

  test("concurrent starts share one process; a switch to cloud mid-start stops it after", async () => {
    const { runtime, world } = setup({ answersAfter: 3 });
    const first = runtime.use(LOCAL);
    const second = runtime.use(LOCAL);
    const cloud = runtime.use(CLOUD);
    await Promise.all([first, second, cloud]);
    expect([world.starts, world.kills]).toEqual([1, 1]);
  });

  test("not installed, or never answering, is reported and nothing is left running", async () => {
    const missing = setup({ installed: false });
    await missing.runtime.use(LOCAL);
    expect((await missing.runtime.view()).ollama.state).toBe("not_installed");

    const silent = setup({ answersAfter: Number.POSITIVE_INFINITY });
    const quick = new OllamaRuntime(
      { status: async () => null, pull },
      {
        find: () => "/bin/ollama",
        start: () => ({ kill: () => silent.world.kills++, exited: new Promise(() => {}) }),
      },
      new Logger(() => {}),
      { pollMs: 1, timeoutMs: 20 },
    );
    await quick.use(LOCAL);
    expect((await quick.view()).ollama.state).toBe("failed");
    expect(silent.world.kills).toBe(1);
  });

  test("stop() on quit stops only what this app started", async () => {
    const { runtime, world } = setup();
    await runtime.use(LOCAL);
    runtime.stop();
    runtime.stop();
    expect(world.kills).toBe(1);
  });

  test("reads as starting from the moment a start is asked for", async () => {
    const { runtime } = setup({ answersAfter: 2 });
    const using = runtime.use(LOCAL);
    expect((await runtime.view()).ollama.state).toBe("starting");
    await using;
    expect((await runtime.view()).ollama.state).toBe("running");
  });

  test("reports a pull in its view until it is cancelled", async () => {
    let aborted = false;
    const runtime = new OllamaRuntime(
      {
        status: async () => UP,
        pull: async (_model, signal, onLine) => {
          onLine({ status: "pulling a", digest: "sha256:a", total: 10, completed: 3 });
          await new Promise((resolve) => signal.addEventListener("abort", resolve));
          aborted = true;
          return err(appError("ollama_pull_cancelled"));
        },
      },
      {
        find: () => "/bin/ollama",
        start: () => ({ kill: () => {}, exited: new Promise(() => {}) }),
      },
      new Logger(() => {}),
      { pollMs: 0, timeoutMs: 1_000 },
    );
    expect((await runtime.pull("smollm2:135m")).ok).toBe(true);
    expect((await runtime.view()).ollama.pull).toEqual({
      model: "smollm2:135m",
      step: "downloading",
      completed: 3,
      total: 10,
      error: null,
    });
    runtime.stop(); // not started by the app: nothing to stop, the pull goes on
    expect((await runtime.view()).ollama.pull).not.toBeNull();
    runtime.cancelPull();
    await Bun.sleep(0);
    expect(aborted).toBe(true);
    expect((await runtime.view()).ollama.pull).toBeNull();
  });
});
