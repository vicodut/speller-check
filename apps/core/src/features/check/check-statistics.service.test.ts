import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, ModelIdentity, Provider } from "../providers";
import type { CallSample } from "../statistics";
import { CheckService } from "./check.service";
import { CheckCache } from "./services/check-cache.service";

const identity: ModelIdentity = { profileId: "p1", model: "test-model", local: true };
const NO_ISSUES = ok('{"issues":[]}');

/** A provider that answers each call with the next scripted reply, and says which profile it is. */
const provider = (replies: Result<string, AppError>[]): Provider => ({
  model: "test-model",
  identity,
  healthcheck: async () => true,
  complete: async (_messages: readonly ChatMessage[]) => replies.shift() ?? NO_ISSUES,
});

const setup = (replies: Result<string, AppError>[]) => {
  const samples: CallSample[] = [];
  const dictionary = { load: async () => ok([]) };
  const service = new CheckService(
    provider(replies),
    new CheckCache(),
    dictionary,
    new Logger(() => {}),
    { record: (batch) => samples.push(...batch) },
  );
  return { service, samples };
};

const SENTENCE = "I has went to the store.";

describe("CheckService statistics", () => {
  test("an answered call is one ok sample with the letters sent and its timing", async () => {
    const { service, samples } = setup([NO_ISSUES]);
    await service.check({ text: SENTENCE });
    expect(samples).toEqual([
      {
        kind: "ok",
        feature: "check",
        identity,
        letters: SENTENCE.length,
        ms: expect.any(Number),
      },
    ]);
  });

  test("a cache hit calls no model and records nothing", async () => {
    const { service, samples } = setup([NO_ISSUES]);
    await service.check({ text: SENTENCE });
    await service.check({ text: SENTENCE });
    expect(samples).toHaveLength(1);
  });

  test("an invalid first answer is an invalid_json failure, then the parsed retry is timed", async () => {
    const { service, samples } = setup([ok("nope"), NO_ISSUES]);
    await service.check({ text: SENTENCE });
    expect(samples.map((s) => (s.kind === "failure" ? s.code : s.kind))).toEqual([
      "invalid_json",
      "ok",
    ]);
  });

  test("a failed call is one failure with its code and no timing", async () => {
    const { service, samples } = setup([err(appError("provider_network"))]);
    await service.check({ text: SENTENCE });
    expect(samples).toEqual([
      { kind: "failure", feature: "check", identity, code: "provider_network" },
    ]);
  });

  test("a timeout is one failure named timeout", async () => {
    const { service, samples } = setup([err(appError("provider_timeout"))]);
    await service.check({ text: SENTENCE });
    expect(samples).toEqual([{ kind: "failure", feature: "check", identity, code: "timeout" }]);
  });
});
