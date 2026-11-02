import { describe, expect, test } from "bun:test";
import type { CoreMessage, ModelIssue } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { ChatMessage, Provider } from "../providers";
import { CheckService } from "./check.service";
import { BATCH_MAX_SENTENCES } from "./check-limits.constants";
import { FieldSessions, type Timers } from "./field-sessions.service";
import { CheckCache } from "./services/check-cache.service";

// The seam: field sessions over the real check service, with a fake model that parks each call.

type Call = { readonly sentences: string[]; reply(failWith?: AppError): void };

/** Each model call parks until the test replies; the reply flags every "teh" it was asked about. */
const parkedProvider = () => {
  const calls: Call[] = [];
  const provider: Provider = {
    model: "test-model",
    healthcheck: async () => true,
    complete: (messages: readonly ChatMessage[]) => {
      const user = messages[1]?.content ?? "";
      const sentences = user
        .slice(user.indexOf("CHECK:\n") + 7)
        .split("\n")
        .map((line) => line.replace(/^\d+\. /, ""));
      return new Promise<Result<string, AppError>>((resolve) => {
        const reply = (failWith?: AppError) =>
          resolve(failWith ? err(failWith) : ok(JSON.stringify({ issues: tehIn(sentences) })));
        calls.push({ sentences, reply });
      });
    },
  };
  return { provider, calls };
};

const tehIn = (sentences: readonly string[]): ModelIssue[] =>
  sentences
    .filter((s) => s.includes(" teh "))
    .map((s) => ({
      original: "teh",
      suggestion: "the",
      reason: "Spelling",
      context: s.replace(/\.$/, ""),
      type: "spelling",
    }));

/** `count` distinct sentences; every third one has a typo. */
const longText = (count: number, tag = "Line") =>
  Array.from({ length: count }, (_, i) =>
    i % 3 === 0 ? `${tag} ${i} has teh word.` : `${tag} ${i} is clean.`,
  ).join(" ");

const typos = (count: number) => Math.ceil(count / 3);

const setup = () => {
  const due: (() => void)[] = [];
  const timers: Timers = {
    setTimeout: (fn) => due.push(fn),
    clearTimeout: () => {},
  };
  const fire = () => {
    for (const fn of due.splice(0)) fn();
  };
  const { provider, calls } = parkedProvider();
  const logs: string[] = [];
  const logger = new Logger((l) => logs.push(l));
  const dictionary = { load: async () => ok([]) };
  const service = new CheckService(provider, new CheckCache(), dictionary, logger);
  const published: CoreMessage[] = [];
  const sessions = new FieldSessions(service, (m) => published.push(m), logger, { timers });
  return { fire, calls, logs, published, sessions };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Replies to the oldest unanswered model call. */
const replyNext = async (calls: Call[], answered: { n: number }, failWith?: AppError) => {
  calls[answered.n++]?.reply(failWith);
  await flush();
};

const summary = (messages: CoreMessage[]) =>
  messages.map((m) =>
    m.type === "issues"
      ? { version: m.version, count: m.issues.length, pending: m.pending }
      : { error: m.type === "error" ? m.code : m.type },
  );

describe("FieldSessions with batched checks", () => {
  test("a long first check runs in batches and publishes all issues found so far", async () => {
    const { fire, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: longText(25) });
    fire();
    await flush();
    const answered = { n: 0 };
    for (let i = 0; i < 3; i++) await replyNext(calls, answered);
    expect(calls.map((c) => c.sentences.length)).toEqual([BATCH_MAX_SENTENCES, 10, 5]);
    expect(summary(published)).toEqual([
      { version: 1, count: typos(10), pending: true },
      { version: 1, count: typos(20), pending: true },
      { version: 1, count: typos(25), pending: undefined },
    ]);
    expect(published.at(-1)).not.toHaveProperty("pending");
  });

  test("a check that fits one batch publishes once, with no pending flag", async () => {
    const { fire, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: longText(6) });
    fire();
    await flush();
    await replyNext(calls, { n: 0 });
    expect(published).toHaveLength(1);
    expect(published[0]).not.toHaveProperty("pending");
    expect(summary(published)).toEqual([{ version: 1, count: 2, pending: undefined }]);
  });

  test("an edit mid-check finishes the batch in flight, drops the rest and restarts", async () => {
    const { fire, calls, logs, published, sessions } = setup();
    const v1 = longText(25);
    const v2 = `${v1} Added teh line.`;
    sessions.update({ fieldId: "f", version: 1, text: v1 });
    fire();
    await flush();
    sessions.update({ fieldId: "f", version: 2, text: v2 });
    fire();
    await flush();
    // The newer run waits for the batch in flight: no second model call yet.
    expect(calls).toHaveLength(1);
    const answered = { n: 0 };
    await replyNext(calls, answered);
    // The finished batch is published (reconciled onto v2); v1's last two batches never run.
    expect(summary(published)).toEqual([{ version: 2, count: typos(10), pending: true }]);
    expect(logs).toContain('{"level":"info","event":"check.batches_dropped","len":2}');
    // The restart sends only what the cache lacks: v1's sentences 10–24 and the new one.
    expect(calls.map((c) => c.sentences.length)).toEqual([10, 10]);
    expect(calls[1]?.sentences[0]).toBe("Line 10 is clean.");
    await replyNext(calls, answered);
    await replyNext(calls, answered);
    expect(calls.map((c) => c.sentences.length)).toEqual([10, 10, 6]);
    expect(summary(published).slice(1)).toEqual([
      { version: 2, count: typos(20), pending: true },
      { version: 2, count: typos(25) + 1, pending: undefined },
    ]);
  });

  test("a failed batch after a partial still reports the error", async () => {
    const { fire, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: longText(15) });
    fire();
    await flush();
    const answered = { n: 0 };
    await replyNext(calls, answered);
    await replyNext(calls, answered, appError("provider_timeout"));
    expect(summary(published)).toEqual([
      { version: 1, count: typos(10), pending: true },
      { error: "provider_timeout" },
    ]);
  });

  test("closing the field drops the remaining batches and publishes nothing more", async () => {
    const { fire, calls, logs, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: longText(25) });
    fire();
    await flush();
    sessions.close("f");
    await replyNext(calls, { n: 0 });
    expect(calls).toHaveLength(1);
    expect(published).toEqual([]);
    expect(logs).toContain('{"level":"info","event":"check.batches_dropped","len":2}');
  });

  test("logs batch counts and timings, never text", async () => {
    const { fire, calls, logs, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: longText(15, "Secret") });
    fire();
    await flush();
    const answered = { n: 0 };
    await replyNext(calls, answered);
    await replyNext(calls, answered);
    const lines = logs.map((l) => JSON.parse(l));
    expect(lines).toContainEqual({ level: "info", event: "check.batches", len: 2 });
    const timed = lines.filter((l) => l.event === "check.batch_done");
    expect(timed.map((l) => l.len)).toEqual([10, 5]);
    expect(timed.every((l) => typeof l.ms === "number")).toBe(true);
    for (const fragment of ["Secret", "teh", "clean", "Spelling"]) {
      expect(logs.join("\n")).not.toContain(fragment);
    }
  });
});
