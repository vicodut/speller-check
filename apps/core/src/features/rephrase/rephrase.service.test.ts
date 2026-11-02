import { describe, expect, test } from "bun:test";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, Provider } from "../providers";
import { RephraseService } from "./rephrase.service";

/** Replies with each scripted reply in turn (the last one repeats) and records the prompts. */
const fakeProvider = (replies: (string | AppError)[]) => {
  const prompts: string[] = [];
  let call = 0;
  const provider: Provider = {
    model: "test-model",
    healthcheck: async () => true,
    complete: async (messages: readonly ChatMessage[]): Promise<Result<string, AppError>> => {
      prompts.push(messages.map((m) => m.content).join("\n"));
      const reply = replies[Math.min(call++, replies.length - 1)] ?? "";
      return typeof reply === "string" ? ok(reply) : err(reply);
    },
  };
  return { provider, prompts };
};

const keepAll = (tone: string, n: number) => ({
  tone,
  segments: Array.from({ length: n }, (_, i) => ({ sentences: [i + 1], keep: true })),
});

const reply = (versions: unknown[], language = "en") => JSON.stringify({ language, versions });

const setup = (replies: (string | AppError)[]) => {
  const { provider, prompts } = fakeProvider(replies);
  const logs: string[] = [];
  const service = new RephraseService(provider, new Logger((line) => logs.push(line)));
  return { service, prompts, logs };
};

const TEXT = "Intro line.\n\nThe meeting moved to Monday. Bring the 3 reports. Thanks.";
const caret = TEXT.indexOf("Bring");

describe("RephraseService", () => {
  test("sends the caret's paragraph as numbered sentences, in one call, without a dictionary", async () => {
    const { service, prompts } = setup([reply([keepAll("casual", 3)])]);
    await service.rephrase({ text: TEXT, caret });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(
      "PASSAGE:\n1. The meeting moved to Monday.\n2. Bring the 3 reports.\n3. Thanks.",
    );
    expect(prompts[0]).not.toContain("Intro line.");
    expect(prompts[0]).not.toContain("DICTIONARY");
  });

  test("returns the passage and sentence offsets from the core's own split", async () => {
    const merged = {
      tone: "concise",
      segments: [
        { sentences: [1, 2], text: "Monday: bring 3 reports." },
        { sentences: [3], keep: true },
      ],
    };
    const { service } = setup([reply([merged, keepAll("casual", 3)], "en")]);
    const result = await service.rephrase({ text: TEXT, caret });
    if (!result.ok) throw new Error(result.error.code);
    const { passage, sentences, versions, language } = result.value;
    expect(TEXT.slice(passage.start, passage.end)).toBe(
      "The meeting moved to Monday. Bring the 3 reports. Thanks.",
    );
    for (const s of sentences) expect(TEXT.slice(s.start, s.end)).toBe(s.text);
    expect(language).toBe("en");
    expect(versions.map((v) => v.tone)).toEqual(["casual", "concise"]);
    expect(versions[1]?.segments[0]).toEqual({ from: 0, to: 1, text: "Monday: bring 3 reports." });
  });

  test("reports the language the model detected", async () => {
    const { service } = setup([reply([keepAll("casual", 1)], "fr")]);
    const result = await service.rephrase({ text: "Merci beaucoup.", caret: 0 });
    expect(result.ok && result.value.language).toBe("fr");
  });

  test("refuses a caret outside any sentence without calling the model", async () => {
    const { service, prompts, logs } = setup([reply([])]);
    const result = await service.rephrase({ text: "One.\n\n\n\nTwo.", caret: 6 });
    expect(!result.ok && result.error.code).toBe("rephrase_no_sentence");
    expect(prompts).toHaveLength(0);
    expect(logs.some((l) => l.includes('"rephrase.failed"'))).toBe(true);
  });

  test("drops invalid versions and logs how many", async () => {
    const gap = { tone: "professional", segments: [{ sentences: [1], keep: true }] };
    const { service, logs } = setup([reply([gap, keepAll("friendlier", 3)])]);
    const result = await service.rephrase({ text: TEXT, caret });
    expect(result.ok && result.value.versions.map((v) => v.tone)).toEqual(["friendlier"]);
    expect(logs).toContain('{"level":"info","event":"rephrase.version_dropped","len":1}');
  });

  test("no valid version is an error", async () => {
    const { service } = setup([reply([{ tone: "casual", segments: [] }])]);
    const result = await service.rephrase({ text: TEXT, caret });
    expect(!result.ok && result.error.code).toBe("rephrase_no_valid_version");
  });

  test("retries once on invalid JSON, then fails", async () => {
    const retried = setup(["not json", reply([keepAll("casual", 3)])]);
    expect((await retried.service.rephrase({ text: TEXT, caret })).ok).toBe(true);
    expect(retried.prompts).toHaveLength(2);

    const failed = setup(["not json"]);
    const result = await failed.service.rephrase({ text: TEXT, caret });
    expect(!result.ok && result.error.code).toBe("model_invalid_json");
    expect(failed.prompts).toHaveLength(2);
  });

  test("passes provider errors through", async () => {
    const { service } = setup([appError("provider_timeout")]);
    const result = await service.rephrase({ text: TEXT, caret });
    expect(!result.ok && result.error.code).toBe("provider_timeout");
  });

  test("logs carry no text, only events, lengths, timings and codes", async () => {
    const versions = [
      { tone: "casual", segments: [{ sentences: [1, 2, 3], text: "Secret rewrite." }] },
    ];
    const { service, logs } = setup([reply(versions)]);
    await service.rephrase({ text: TEXT, caret });
    const events = logs.map((l) => JSON.parse(l).event);
    expect(events).toEqual(["rephrase.requested", "rephrase.done"]);
    for (const line of logs) {
      expect(
        Object.keys(JSON.parse(line)).every((k) =>
          ["level", "event", "ms", "len", "code"].includes(k),
        ),
      ).toBe(true);
      expect(line).not.toMatch(/meeting|Monday|reports|Secret/);
    }
  });
});
