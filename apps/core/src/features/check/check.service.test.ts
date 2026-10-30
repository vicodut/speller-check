import { describe, expect, test } from "bun:test";
import type { ModelIssue } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { DictionaryEntry } from "../dictionary";
import type { ChatMessage, Provider } from "../providers";
import { CheckService } from "./check.service";
import { CheckCache } from "./services/check-cache.service";

const has: ModelIssue = {
  original: "has went",
  suggestion: "went",
  reason: "Verb form",
  context: "I has went to",
  type: "grammar",
};
const est: ModelIssue = {
  original: "est",
  suggestion: "sont",
  reason: "Accord",
  context: "enfants est partis",
  type: "grammar",
};

/** Replies with the issues whose `original` appears in the CHECK section of the prompt. */
const scriptedProvider = (known: ModelIssue[], failWith?: AppError) => {
  const prompts: string[] = [];
  const provider: Provider = {
    model: "test-model",
    healthcheck: async () => true,
    complete: async (messages: readonly ChatMessage[]): Promise<Result<string, AppError>> => {
      const user = messages[1]?.content ?? "";
      prompts.push(user);
      if (failWith) return err(failWith);
      const checked = user.slice(user.indexOf("CHECK:"));
      return ok(JSON.stringify({ issues: known.filter((i) => checked.includes(i.original)) }));
    },
  };
  return { provider, prompts };
};

const setup = (known: ModelIssue[], entries: DictionaryEntry[] = [], failWith?: AppError) => {
  const { provider, prompts } = scriptedProvider(known, failWith);
  const logs: string[] = [];
  const dictionary = { load: async () => ok(entries) };
  const service = new CheckService(
    provider,
    new CheckCache(),
    dictionary,
    new Logger((l) => logs.push(l)),
  );
  return { service, prompts, logs };
};

const spans = (text: string, result: Awaited<ReturnType<CheckService["check"]>>) =>
  result.ok ? result.value.issues.map((i) => text.slice(i.start, i.end)) : result.error.code;

describe("CheckService", () => {
  test("returns located issues with absolute offsets", async () => {
    const { service } = setup([has, est]);
    const text = "Hello. I has went to the store. Les enfants est partis.";
    const result = await service.check({ text });
    expect(spans(text, result)).toEqual(["has went", "est"]);
  });

  test("sends only changed sentences and reuses the cache", async () => {
    const { service, prompts } = setup([has, est]);
    await service.check({ text: "I has went to the store. Les enfants est partis." });
    const text = "I has went to the store. Les enfants est partis. New one.";
    const result = await service.check({ text });
    expect(spans(text, result)).toEqual(["has went", "est"]);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("CHECK:\n1. New one.");
    expect(prompts[1]).toContain("CONTEXT:\nLes enfants est partis.");
  });

  test("does not call the model when everything is cached or empty", async () => {
    const { service, prompts } = setup([has]);
    await service.check({ text: "I has went to it." });
    await service.check({ text: "I has went to it." });
    await service.check({ text: "  " });
    expect(prompts).toHaveLength(1);
  });

  test("checks a repeated sentence once and flags every copy", async () => {
    const { service, prompts } = setup([has]);
    const text = "I has went to it. I has went to it.";
    expect(spans(text, await service.check({ text }))).toEqual(["has went", "has went"]);
    expect(prompts[0]).not.toContain("2.");
  });

  test("never returns issues on dictionary terms, and tells the model about them", async () => {
    const nest: ModelIssue = {
      original: "NestJS",
      suggestion: "Nest JS",
      reason: "r",
      context: "use NestJS daily",
      type: "spelling",
    };
    const { service, prompts } = setup([nest, has], [{ term: "NestJS", note: "framework" }]);
    const text = "We use NestJS daily. I has went to it.";
    expect(spans(text, await service.check({ text }))).toEqual(["has went"]);
    expect(prompts[0]).toContain("DICTIONARY:\n- NestJS (framework)");
  });

  test("drops issues that cannot be located", async () => {
    const ghost: ModelIssue = { ...has, original: "teh", context: "fixed teh bug" };
    const provider: Provider = {
      model: "test-model",
      healthcheck: async () => true,
      complete: async () => ok(JSON.stringify({ issues: [ghost, has] })),
    };
    const dictionary = { load: async () => ok([]) };
    const logs: string[] = [];
    const service = new CheckService(
      provider,
      new CheckCache(),
      dictionary,
      new Logger((l) => logs.push(l)),
    );
    const text = "I has went to it.";
    expect(spans(text, await service.check({ text }))).toEqual(["has went"]);
    expect(logs.some((l) => l.includes('"code":"issue_not_found"'))).toBe(true);
  });

  test("passes the version through", async () => {
    const { service } = setup([]);
    expect(await service.check({ text: "Fine.", version: 7 })).toEqual({
      ok: true,
      value: { version: 7, issues: [] },
    });
  });

  test("returns the provider error and caches nothing", async () => {
    const { service } = setup([has], [], appError("provider_timeout"));
    expect(await service.check({ text: "I has went to it." })).toEqual({
      ok: false,
      error: { code: "provider_timeout" },
    });
  });

  test("never logs user text", async () => {
    const { service, logs } = setup([has, est]);
    await service.check({ text: "I has went to the store. Les enfants est partis." });
    const output = logs.join("\n");
    for (const fragment of ["has went", "enfants", "store", "Verb form"]) {
      expect(output).not.toContain(fragment);
    }
  });
});
