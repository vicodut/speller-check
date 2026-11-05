import { describe, expect, test } from "bun:test";
import type { CoreMessage, RephraseToneResult } from "@gc/protocol";
import { appError } from "../../shared/errors";
import { err, ok } from "../../shared/result";
import { RephraseJobs, type Rephraser } from "./rephrase-jobs.service";

const TEXT = "Intro.\n\nHello there. See you.";

const tone: RephraseToneResult = {
  passage: { start: 8, end: 29 },
  sentences: [
    { text: "Hello there.", start: 8, end: 20 },
    { text: "See you.", start: 21, end: 29 },
  ],
  language: "en",
  tone: "casual",
  segments: [{ from: 0, to: 1, text: "Hi, see you." }],
};

/** Sends one tone, then waits until released (latest first) or cancelled before finishing. */
const gatedRephraser = () => {
  const signals: AbortSignal[] = [];
  const releases: (() => void)[] = [];
  const inputs: Parameters<Rephraser["rephrase"]>[0][] = [];
  const rephraser: Rephraser = {
    rephrase: async (input, run) => {
      inputs.push(input);
      if (run.signal) signals.push(run.signal);
      run.onTone(tone);
      await new Promise<void>((resolve) => {
        releases.push(resolve);
        run.signal?.addEventListener("abort", () => resolve());
      });
      return run.signal?.aborted ? err(appError("rephrase_cancelled")) : ok(1);
    },
  };
  return { rephraser, signals, inputs, release: () => releases.pop()?.() };
};

const request = (requestId: number, text = TEXT) => ({
  type: "rephrase.request" as const,
  fieldId: "f",
  version: 3,
  requestId,
  text,
  caret: text.indexOf("Hello"),
});

const setup = () => {
  const gate = gatedRephraser();
  const sent: CoreMessage[] = [];
  const jobs = new RephraseJobs(gate.rephraser, (m) => sent.push(m));
  return { ...gate, sent, jobs };
};

describe("RephraseJobs", () => {
  test("sends each tone with the request's ids, then done", async () => {
    const t = setup();
    const running = t.jobs.request(request(1));
    expect(t.sent).toEqual([
      { type: "rephrase.tone", fieldId: "f", version: 3, requestId: 1, ...tone },
    ]);
    t.release();
    await running;
    expect(t.sent[1]).toEqual({
      type: "rephrase.done",
      fieldId: "f",
      version: 3,
      requestId: 1,
      count: 1,
    });
  });

  test("passes the tones asked for to the rephraser", async () => {
    const t = setup();
    const running = t.jobs.request({ ...request(1), tones: ["concise"] });
    expect(t.inputs[0]?.tones).toEqual(["concise"]);
    t.release();
    await running;
  });

  test("a newer request for the field cancels the older one", async () => {
    const t = setup();
    const first = t.jobs.request(request(1));
    const second = t.jobs.request(request(2));
    await first;
    expect(t.signals[0]?.aborted).toBe(true);
    expect(t.signals[1]?.aborted).toBe(false);
    expect(t.sent).toContainEqual({
      type: "error",
      code: "rephrase_cancelled",
      fieldId: "f",
      request: "rephrase",
      requestId: 1,
    });
    t.release();
    await second;
    expect(t.sent.at(-1)).toMatchObject({ type: "rephrase.done", requestId: 2 });
  });

  test("an edit of the passage cancels; an edit after it or the same text doesn't", async () => {
    const t = setup();
    const running = t.jobs.request(request(1));
    t.jobs.edited("f", TEXT);
    t.jobs.edited("f", `${TEXT} More.`);
    t.jobs.edited("other", "x");
    expect(t.signals[0]?.aborted).toBe(false);
    t.jobs.edited("f", TEXT.replace("there", "thar"));
    expect(t.signals[0]?.aborted).toBe(true);
    await running;
  });

  test("a cancel or disposing the connection stops the job", async () => {
    const t = setup();
    const a = t.jobs.request(request(1));
    t.jobs.cancel("f");
    await a;
    expect(t.signals[0]?.aborted).toBe(true);

    const b = t.jobs.request(request(2));
    t.jobs.dispose();
    await b;
    expect(t.signals[1]?.aborted).toBe(true);
  });

  test("a failure is a rephrase-tagged error with the request id", async () => {
    const sent: CoreMessage[] = [];
    const failing: Rephraser = { rephrase: async () => err(appError("rephrase_no_sentence")) };
    await new RephraseJobs(failing, (m) => sent.push(m)).request(request(5));
    expect(sent).toEqual([
      {
        type: "error",
        code: "rephrase_no_sentence",
        fieldId: "f",
        request: "rephrase",
        requestId: 5,
      },
    ]);
  });
});
