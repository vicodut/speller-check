import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { OllamaStatus } from "./ollama.client";
import { OllamaPuller } from "./ollama-pull.service";
import type { PullLine } from "./pull-progress.util";

const UP: OllamaStatus = { version: "0.40.13", models: [] };
const LAYER = { status: "pulling a", digest: "sha256:a", total: 100 };

/**
 * A fake Ollama whose pull streams `lines`, then waits for `finish` (or an abort) before ending
 * with `outcome`.
 */
const setup = (opts: { up?: boolean; outcome?: Result<void, AppError> } = {}) => {
  const world = { pulls: 0, logs: [] as string[] };
  let finish = () => {};
  const client = {
    status: async () => (opts.up === false ? null : UP),
    pull: async (_model: string, signal: AbortSignal, onLine: (line: PullLine) => void) => {
      world.pulls++;
      onLine({ status: "pulling manifest" });
      onLine({ ...LAYER, completed: 40 });
      await new Promise<void>((resolve) => {
        finish = resolve;
        signal.addEventListener("abort", () => resolve());
      });
      if (signal.aborted) return err(appError("ollama_pull_cancelled"));
      const outcome = opts.outcome ?? ok(undefined);
      if (outcome.ok) onLine({ status: "success" });
      return outcome;
    },
  };
  const logger = new Logger((line) => world.logs.push(JSON.parse(line).event));
  const puller = new OllamaPuller(client, logger);
  return { puller, world, finish: () => finish() };
};

describe("OllamaPuller", () => {
  test("reports live progress, then done", async () => {
    const { puller, world, finish } = setup();
    expect(puller.view()).toBeNull();
    expect((await puller.start("qwen3:8b")).ok).toBe(true);
    expect(puller.view()).toEqual({
      model: "qwen3:8b",
      step: "downloading",
      completed: 40,
      total: 100,
      error: null,
    });
    finish();
    await puller.whenSettled();
    expect(puller.view()?.step).toBe("done");
    expect(world.logs).toEqual(["ollama.pull_started", "ollama.pull_done"]);
  });

  test("one pull at a time", async () => {
    const { puller, world, finish } = setup();
    const [first, second] = await Promise.all([puller.start("a:1b"), puller.start("b:1b")]);
    expect([first.ok, second.ok]).toEqual([true, false]);
    expect(second).toEqual({ ok: false, error: { code: "pull_in_progress" } });
    expect(world.pulls).toBe(1);
    finish();
    await puller.whenSettled();
    expect((await puller.start("b:1b")).ok).toBe(true);
  });

  test("a cancelled pull is forgotten at once", async () => {
    const { puller, world } = setup();
    await puller.start("qwen3:8b");
    const settled = puller.whenSettled();
    puller.cancel();
    expect(puller.view()).toBeNull();
    await settled;
    expect(world.logs).toEqual(["ollama.pull_started", "ollama.pull_cancelled"]);
  });

  test("a failure keeps its progress and its error code", async () => {
    const { puller, world, finish } = setup({ outcome: err(appError("ollama_model_not_found")) });
    await puller.start("nope:1b");
    finish();
    await puller.whenSettled();
    expect(puller.view()).toMatchObject({ step: "failed", error: "ollama_model_not_found" });
    expect(world.logs).toEqual(["ollama.pull_started", "ollama.pull_failed"]);
  });

  test("needs Ollama running", async () => {
    const { puller, world } = setup({ up: false });
    expect(await puller.start("qwen3:8b")).toEqual({
      ok: false,
      error: { code: "ollama_unreachable" },
    });
    expect(world.pulls).toBe(0);
  });
});
