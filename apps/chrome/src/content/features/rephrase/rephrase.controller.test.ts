import { describe, expect, test } from "bun:test";
import { MAX_KEPT_FIELDS } from "./rephrase.controller";
import { done, type FakeField, setup, tone, tones } from "./rephrase-controller.fixture";

describe("RephraseController", () => {
  test("is enabled only when the caret is in a sentence", () => {
    const { field, controller } = setup();
    expect(controller.state(field)).toEqual({ kind: "idle", enabled: true });
    field.caret = null;
    expect(controller.state(field)).toEqual({ kind: "idle", enabled: false });
  });

  test("sends one request with the text, caret and a request id, then shows four loading tones", () => {
    const { field, sent, controller } = setup();
    controller.request(field);
    controller.request(field);
    expect(sent).toEqual([
      {
        type: "rephrase.request",
        fieldId: "f1",
        version: 3,
        requestId: 1,
        text: field.text,
        caret: 10,
      },
    ]);
    expect(controller.state(field)).toEqual({
      kind: "result",
      versions: [],
      pending: ["Professional", "Casual", "Concise", "Friendlier"],
    });
    controller.fail("f1", 1);
  });

  test("never sends without a caret in a sentence", () => {
    const { field, sent, controller } = setup("One.\n\n\n\nTwo.", 6);
    controller.request(field);
    expect(sent).toEqual([]);
  });

  test("versions appear one by one; done ends the loading state", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(tone("professional"));
    let state = controller.state(field);
    expect(tones(state)).toEqual(["professional"]);
    expect(state.kind === "result" && state.pending).toEqual(["Casual", "Concise", "Friendlier"]);
    expect(state.kind === "result" && state.versions[0]?.rows).toEqual([
      { kind: "unchanged", text: "Intro." },
      { kind: "rewritten", text: "Hey.", segment: 1, replace: "available" },
    ]);
    controller.receive(tone("concise"));
    controller.receive(done(1, 2));
    state = controller.state(field);
    expect(tones(state)).toEqual(["professional", "concise"]);
    expect(state.kind === "result" && state.pending).toEqual([]);
  });

  test("drops replies to another request or version, and a result whose passage changed", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(tone("professional", 9));
    controller.receive(tone("professional", 1, 2));
    expect(tones(controller.state(field))).toEqual([]);
    controller.receive(tone("casual"));
    field.text = "Intro. Hello thar.";
    expect(controller.state(field).kind).toBe("idle");
  });

  test("keeps the result across a blur, the panel closing and a refocus", () => {
    const { field, controller } = setup();
    controller.request(field);
    controller.receive(tone("professional"));
    // Blur: the watcher closes the field; nothing tells the controller to forget it.
    controller.receive(tone("casual"));
    controller.receive(done(1, 2));
    controller.track(field, "f1", 4); // refocus sends a new version of the same text
    expect(tones(controller.state(field))).toEqual(["professional", "casual"]);
  });

  test("a tone that arrives unseen puts the ready marker until the panel shows it", () => {
    const { field, controller } = setup();
    controller.request(field);
    expect(controller.hasNews(field)).toBe(false);
    controller.receive(tone("professional"));
    expect(controller.hasNews(field)).toBe(true);
    controller.seen(field);
    expect(controller.hasNews(field)).toBe(false);
    controller.receive(tone("casual"));
    field.text = "Changed. Hello there.";
    expect(controller.hasNews(field)).toBe(false);
  });

  test("a failure or a timeout ends the loading state, keeping tones already shown", async () => {
    const failed = setup();
    failed.controller.request(failed.field);
    failed.controller.fail("f1", 1);
    expect(failed.controller.state(failed.field).kind).toBe("idle");

    const partial = setup(undefined, undefined, 5);
    partial.controller.request(partial.field);
    partial.controller.receive(tone("professional"));
    await Bun.sleep(20);
    const state = partial.controller.state(partial.field);
    expect(state.kind === "result" && state.pending).toEqual([]);
    expect(tones(state)).toEqual(["professional"]);
  });

  test("a new request replaces the result; the old request's replies are dropped", () => {
    const { field, sent, controller } = setup();
    controller.request(field);
    controller.receive(tone("professional"));
    controller.receive(done());
    controller.request(field);
    expect(sent[1]?.requestId).toBe(2);
    controller.receive(tone("casual", 1));
    expect(tones(controller.state(field))).toEqual([]);
  });

  test("keeps results for the last few fields only", () => {
    const { controller } = setup();
    const fields = Array.from({ length: MAX_KEPT_FIELDS + 1 }, (_, i) => {
      const field = { text: "Intro. Hello there.", caret: 10 };
      controller.track(field, `g${i}`, 1);
      controller.request(field);
      return field;
    });
    expect(controller.state(fields[0] as FakeField).kind).toBe("idle");
    expect(controller.state(fields[1] as FakeField).kind).toBe("result");
    for (const field of fields) controller.fail(`g${fields.indexOf(field)}`, undefined);
  });
});
