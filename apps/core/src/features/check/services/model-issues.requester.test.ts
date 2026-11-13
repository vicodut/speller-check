import { describe, expect, test } from "bun:test";
import { appError } from "../../../shared/errors";
import { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import type { ChatMessage, Provider } from "../../providers";
import { requestModelIssues } from "./model-issues.requester";

const fakeProvider = (replies: Result<string, ReturnType<typeof appError>>[]) => {
  const calls: (readonly ChatMessage[])[] = [];
  const provider: Provider = {
    model: "m",
    healthcheck: async () => true,
    complete: async (messages) => {
      calls.push(messages);
      return replies.shift() ?? err(appError("provider_network"));
    },
  };
  return { provider, calls };
};

const messages: ChatMessage[] = [{ role: "user", content: "x" }];
const logger = new Logger(() => {});

describe("requestModelIssues", () => {
  test("returns parsed issues on the first valid reply", async () => {
    const { provider, calls } = fakeProvider([ok('{"issues":[]}')]);
    expect((await requestModelIssues(provider, messages, logger)).result).toEqual({
      ok: true,
      value: [],
    });
    expect(calls).toHaveLength(1);
  });

  test("retries once with a reminder after invalid JSON", async () => {
    const { provider, calls } = fakeProvider([ok("nope"), ok('{"issues":[]}')]);
    expect((await requestModelIssues(provider, messages, logger)).result).toEqual({
      ok: true,
      value: [],
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toHaveLength(2);
  });

  test("gives up after the second invalid reply", async () => {
    const { provider, calls } = fakeProvider([ok("nope"), ok("still nope"), ok("{}")]);
    expect((await requestModelIssues(provider, messages, logger)).result).toEqual({
      ok: false,
      error: { code: "model_invalid_json" },
    });
    expect(calls).toHaveLength(2);
  });

  test("does not retry provider errors", async () => {
    const { provider, calls } = fakeProvider([err(appError("provider_timeout"))]);
    expect((await requestModelIssues(provider, messages, logger)).result).toEqual({
      ok: false,
      error: { code: "provider_timeout" },
    });
    expect(calls).toHaveLength(1);
  });
});
