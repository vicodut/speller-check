import { describe, expect, test } from "bun:test";
import type { RephraseRequestMessage, RephraseResultMessage } from "@gc/protocol";
import { RephraseController } from "./rephrase.controller";

type FakeField = { text: string; caret: number | null };

const setup = (text = "Intro. Hello there.", caret: number | null = 10, timeoutMs = 1000) => {
  const field: FakeField = { text, caret };
  const sent: RephraseRequestMessage[] = [];
  let changes = 0;
  const controller = new RephraseController<FakeField>({
    send: (m) => sent.push(m),
    readText: (f) => f.text,
    readCaret: (f) => f.caret,
    changed: () => changes++,
    timeoutMs,
  });
  controller.track(field, "f1", 3);
  return { field, sent, controller, changes: () => changes };
};

const result = (version = 3): RephraseResultMessage => ({
  type: "rephrase.result",
  fieldId: "f1",
  version,
  passage: { start: 0, end: 19 },
  sentences: [
    { text: "Intro.", start: 0, end: 6 },
    { text: "Hello there.", start: 7, end: 19 },
  ],
  language: "en",
  versions: [
    {
      tone: "casual",
      segments: [
        { from: 0, to: 0, keep: true },
        { from: 1, to: 1, text: "Hey." },
      ],
    },
  ],
});

describe("RephraseController", () => {
  test("is enabled only when the caret is in a sentence", () => {
    const { field, controller } = setup();
    expect(controller.state(field)).toEqual({ kind: "idle", enabled: true });
    field.caret = null;
    expect(controller.state(field)).toEqual({ kind: "idle", enabled: false });
  });

  test("sends one request with the text and caret, then shows loading", () => {
    const { field, sent, controller } = setup();
    controller.request(field);
    controller.request(field);
    expect(sent).toEqual([
      { type: "rephrase.request", fieldId: "f1", version: 3, text: field.text, caret: 10 },
    ]);
    expect(controller.state(field).kind).toBe("loading");
    controller.fail(field);
  });

  test("never sends without a caret in a sentence", () => {
    const { field, sent, controller } = setup("One.\n\n\n\nTwo.", 6);
    controller.request(field);
    expect(sent).toEqual([]);
  });

  test("shows the result rows while the passage is unchanged", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(field, result());
    const state = controller.state(field);
    expect(state.kind === "result" && state.versions[0]?.rows).toEqual([
      { kind: "unchanged", text: "Intro." },
      { kind: "rewritten", text: "Hey." },
    ]);
    field.text = "Intro. Hello you.";
    expect(controller.state(field).kind).toBe("idle");
  });

  test("drops a result for an older request or a changed passage", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(field, result(2));
    expect(controller.state(field).kind).toBe("loading");
    field.text = "Intro. Hello thar.";
    controller.receive(field, result());
    expect(controller.state(field).kind).toBe("idle");
  });

  test("a failure or a timeout just ends the loading state", async () => {
    const failed = setup();
    failed.controller.request(failed.field);
    failed.controller.fail(failed.field);
    expect(failed.controller.state(failed.field).kind).toBe("idle");

    const slow = setup(undefined, undefined, 5);
    slow.controller.request(slow.field);
    await Bun.sleep(20);
    expect(slow.controller.state(slow.field).kind).toBe("idle");
    expect(slow.changes()).toBe(2);
  });

  test("closing the field forgets its result", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(field, result());
    controller.forget(field);
    expect(controller.state(field)).toEqual({ kind: "idle", enabled: false });
  });
});
