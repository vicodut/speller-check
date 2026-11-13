import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, Provider } from "./provider";
import { timedModelCall } from "./timed-model-call.service";
import { TimeoutRetryProvider } from "./timeout-retry.provider";

type Step = { readonly takes: number; readonly reply: Result<string, AppError> };

/** The call's outcome as its result says: "ok", or the error code. */
const outcomeOf = (timed: { readonly result: Result<unknown, AppError> }) =>
  timed.result.ok ? "ok" : timed.result.error.code;

/**
 * A fake clock and a provider whose each request advances it by `takes` ms; with
 * `retryOnTimeout` it sits behind the real TimeoutRetryProvider, as in the core.
 */
const scripted = (steps: Step[], retryOnTimeout = false) => {
  let clock = 1000;
  const calls: (readonly ChatMessage[])[] = [];
  const inner: Provider = {
    model: "m",
    healthcheck: async () => true,
    complete: async (messages) => {
      calls.push(messages);
      const step = steps.shift();
      if (!step) throw new Error("unexpected call");
      clock += step.takes;
      return step.reply;
    },
  };
  const provider = retryOnTimeout
    ? new TimeoutRetryProvider(inner, 120_000, new Logger(() => {}))
    : inner;
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
      ms: 40,
      attempts: [{ outcome: "ok", ms: 40 }],
    });
  });

  test("a provider failure carries its error code as the outcome, without a retry", async () => {
    const { provider, calls, now } = scripted([
      { takes: 15, reply: err(appError("provider_network")) },
    ]);
    const timed = await call(provider, now);
    expect(outcomeOf(timed)).toBe("provider_network");
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
    expect(outcomeOf(timed)).toBe("ok");
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
    expect(outcomeOf(timed)).toBe("provider_timeout");
    expect(timed.ms).toBe(120_000);
    expect(calls).toHaveLength(2); // both attempts inside the provider, no parse retry
  });

  test("an unparsable reply is retried once with the reminder, timed until parsed", async () => {
    const { provider, calls, now } = scripted([
      { takes: 50, reply: ok("nope") },
      { takes: 60, reply: ok("{}") },
    ]);
    const logs: string[] = [];
    const timed = await call(provider, now, logs);
    expect(timed).toMatchObject({ result: ok(2), ms: 110 });
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

  test("each parse attempt is listed with its own outcome and timing", async () => {
    const { provider, now } = scripted([
      { takes: 50, reply: ok("nope") },
      { takes: 60, reply: ok("{}") },
    ]);
    const timed = await call(provider, now);
    expect(timed.attempts).toEqual([
      { outcome: "model_invalid_json", ms: 50 },
      { outcome: "ok", ms: 60 },
    ]);
  });

  test("a timeout retried inside the provider is timed from the attempt that answered", async () => {
    const { provider, now } = scripted(
      [
        { takes: 30_000, reply: err(appError("provider_timeout")) },
        { takes: 900, reply: ok("{}") },
      ],
      true,
    );
    expect((await call(provider, now)).attempts).toEqual([{ outcome: "ok", ms: 900 }]);
  });

  test("a second unparsable reply fails with the parse error", async () => {
    const { provider, calls, now } = scripted([
      { takes: 50, reply: ok("nope") },
      { takes: 60, reply: ok("still nope") },
    ]);
    const timed = await call(provider, now);
    expect(outcomeOf(timed)).toBe("model_invalid_json");
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
    expect(timed).toMatchObject({
      feature: "rephrase",
      result: err(appError("model_invalid_json")),
    });
    expect(calls).toHaveLength(1);
  });
});
