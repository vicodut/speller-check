import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, CompleteOptions, Provider } from "./provider";
import { timedModelCall } from "./timed-model-call.util";

type Step = { readonly takes: number; readonly reply: Result<string, AppError> };

/** A fake clock and a provider whose each call advances it by `takes` ms. */
const scripted = (steps: Step[], retryOnTimeout = false) => {
  let clock = 1000;
  const calls: (readonly ChatMessage[])[] = [];
  const attempt = (): Result<string, AppError> => {
    const step = steps.shift();
    if (!step) throw new Error("unexpected call");
    clock += step.takes;
    return step.reply;
  };
  const provider: Provider = {
    model: "m",
    healthcheck: async () => true,
    complete: async (messages, options: CompleteOptions = {}) => {
      calls.push(messages);
      const first = attempt();
      if (!retryOnTimeout || first.ok || first.error.code !== "provider_timeout") return first;
      options.onRetry?.();
      return attempt();
    },
  };
  return { provider, calls, now: () => clock };
};

const messages: ChatMessage[] = [{ role: "user", content: "x" }];
const retryMessage: ChatMessage = { role: "user", content: "JSON only" };
const parse = (raw: string): Result<number, AppError> =>
  raw.startsWith("{") ? ok(raw.length) : err(appError("model_invalid_json"));

const call = (provider: Provider, now: () => number, logs: string[] = []) =>
  timedModelCall({
    feature: "check",
    provider,
    messages,
    parse,
    retryMessage,
    logger: new Logger((l) => logs.push(l)),
    now,
  });

describe("timedModelCall", () => {
  test("a parsed answer is ok, timed from request to parse", async () => {
    const { provider, now } = scripted([{ takes: 40, reply: ok("{}") }]);
    expect(await call(provider, now)).toEqual({
      feature: "check",
      result: ok(2),
      outcome: "ok",
      ms: 40,
    });
  });

  test("a provider failure carries its error code as the outcome, without a retry", async () => {
    const { provider, calls, now } = scripted([
      { takes: 15, reply: err(appError("provider_network")) },
    ]);
    const timed = await call(provider, now);
    expect(timed.outcome).toBe("provider_network");
    expect(timed.result).toEqual(err(appError("provider_network")));
    expect(timed.ms).toBe(15);
    expect(calls).toHaveLength(1);
  });

  test("a timeout followed by a successful retry is timed from the successful attempt", async () => {
    const { provider, now } = scripted(
      [
        { takes: 30_000, reply: err(appError("provider_timeout")) },
        { takes: 900, reply: ok("{}") },
      ],
      true,
    );
    const timed = await call(provider, now);
    expect(timed.outcome).toBe("ok");
    expect(timed.ms).toBe(900);
  });

  test("a timeout on the retry too ends as a timeout, timed from the final attempt", async () => {
    const { provider, calls, now } = scripted(
      [
        { takes: 30_000, reply: err(appError("provider_timeout")) },
        { takes: 120_000, reply: err(appError("provider_timeout")) },
      ],
      true,
    );
    const timed = await call(provider, now);
    expect(timed.outcome).toBe("provider_timeout");
    expect(timed.ms).toBe(120_000);
    expect(calls).toHaveLength(1);
  });

  test("an unparsable reply is retried once with the reminder, timed until parsed", async () => {
    const { provider, calls, now } = scripted([
      { takes: 50, reply: ok("nope") },
      { takes: 60, reply: ok("{}") },
    ]);
    const logs: string[] = [];
    const timed = await call(provider, now, logs);
    expect(timed).toMatchObject({ result: ok(2), outcome: "ok", ms: 110 });
    expect(calls[1]).toEqual([...messages, retryMessage]);
    expect(logs.some((l) => l.includes('"parse.retry"'))).toBe(true);
  });

  test("a timeout on the parse retry drops only the timed-out attempt", async () => {
    const { provider, now } = scripted(
      [
        { takes: 50, reply: ok("nope") },
        { takes: 30_000, reply: err(appError("provider_timeout")) },
        { takes: 60, reply: ok("{}") },
      ],
      true,
    );
    expect((await call(provider, now)).ms).toBe(110);
  });

  test("a second unparsable reply fails with the parse error", async () => {
    const { provider, calls, now } = scripted([
      { takes: 50, reply: ok("nope") },
      { takes: 60, reply: ok("still nope") },
    ]);
    const timed = await call(provider, now);
    expect(timed.outcome).toBe("model_invalid_json");
    expect(calls).toHaveLength(2);
  });

  test("a cancelled call is not retried after an unparsable reply", async () => {
    const controller = new AbortController();
    controller.abort();
    const { provider, calls, now } = scripted([{ takes: 5, reply: ok("nope") }]);
    const timed = await timedModelCall({
      feature: "rephrase",
      provider,
      messages,
      parse,
      retryMessage,
      logger: new Logger(() => {}),
      signal: controller.signal,
      now,
    });
    expect(timed).toMatchObject({ feature: "rephrase", outcome: "model_invalid_json" });
    expect(calls).toHaveLength(1);
  });
});
