import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, CompleteOptions, Provider } from "./provider";
import { TimeoutRetryProvider } from "./timeout-retry.provider";

type Reply = Result<string, AppError>;

const fake = (replies: Reply[]) => {
  const calls: CompleteOptions[] = [];
  let warmed = 0;
  const inner: Provider = {
    model: "m",
    complete: async (_m: readonly ChatMessage[], options: CompleteOptions = {}) => {
      calls.push(options);
      const next = replies.shift();
      if (!next) throw new Error("unexpected call");
      return next;
    },
    healthcheck: async () => true,
    warmUp: async () => {
      warmed += 1;
    },
  };
  const logs: string[] = [];
  const provider = new TimeoutRetryProvider(inner, 120_000, new Logger((l) => logs.push(l)));
  return { provider, calls, logs, warmed: () => warmed };
};

const messages = [{ role: "user", content: "I has went." }] as const;
const timeout = err(appError("provider_timeout"));

describe("TimeoutRetryProvider", () => {
  test("passes a reply through untouched", async () => {
    const { provider, calls } = fake([ok("{}")]);
    expect(await provider.complete(messages)).toEqual(ok("{}"));
    expect(calls).toHaveLength(1);
    expect(provider.model).toBe("m");
  });

  test("retries a timed-out call once, with the longer timeout", async () => {
    const { provider, calls, logs } = fake([timeout, ok("{}")]);
    const signal = new AbortController().signal;
    expect(await provider.complete(messages, { signal })).toEqual(ok("{}"));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ signal, timeoutMs: 120_000 });
    expect(logs.some((l) => l.includes('"provider.retry_after_timeout"'))).toBe(true);
    expect(logs.join("\n")).not.toContain("has went");
  });

  test("returns the second timeout instead of retrying again", async () => {
    const { provider, calls } = fake([timeout, timeout]);
    expect(await provider.complete(messages)).toEqual(timeout);
    expect(calls).toHaveLength(2);
  });

  test("does not retry other errors", async () => {
    const network = err(appError("provider_network"));
    const { provider, calls } = fake([network]);
    expect(await provider.complete(messages)).toEqual(network);
    expect(calls).toHaveLength(1);
  });

  test("does not retry once the caller has cancelled", async () => {
    const controller = new AbortController();
    const { provider, calls } = fake([timeout]);
    controller.abort();
    expect(await provider.complete(messages, { signal: controller.signal })).toEqual(timeout);
    expect(calls).toHaveLength(1);
  });

  test("delegates the warm-up", async () => {
    const { provider, warmed } = fake([]);
    await provider.warmUp();
    expect(warmed()).toBe(1);
  });
});
