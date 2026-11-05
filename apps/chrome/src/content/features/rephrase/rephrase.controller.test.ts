import { describe, expect, test } from "bun:test";
import { MAX_KEPT_FIELDS } from "./rephrase.controller";
import { done, type FakeField, setup, statuses, tone, tones } from "./rephrase-controller.fixture";

describe("RephraseController", () => {
  test("the four tone buttons are enabled only when the caret is in a sentence", () => {
    const { field, controller } = setup();
    let state = controller.state(field);
    expect(state.kind === "idle" && state.enabled).toBe(true);
    expect(state.tones.map((b) => b.label)).toEqual([
      "Professional",
      "Casual",
      "Concise",
      "Friendlier",
    ]);
    field.caret = null;
    state = controller.state(field);
    expect(state.kind === "idle" && state.enabled).toBe(false);
  });

  test("a tone click sends one request for that tone only, then shows it loading", () => {
    const { field, sent, controller } = setup();
    controller.request(field, "concise");
    controller.request(field, "concise");
    expect(sent).toEqual([
      {
        type: "rephrase.request",
        fieldId: "f1",
        version: 3,
        requestId: 1,
        text: field.text,
        caret: 10,
        tones: ["concise"],
      },
    ]);
    const state = controller.state(field);
    expect(state.kind === "result" && state.pending).toEqual(["Concise"]);
    expect(statuses(state)).toEqual(["available", "available", "loading", "available"]);
    controller.fail("f1", 1);
  });

  test("never sends without a caret in a sentence", () => {
    const { field, sent, controller } = setup("One.\n\n\n\nTwo.", 6);
    controller.request(field, "casual");
    expect(sent).toEqual([]);
  });

  test("the tone arrives, done ends the loading state and its button shows it is done", () => {
    const { field, controller } = setup();
    controller.request(field, "professional");
    controller.receive(tone("professional"));
    let state = controller.state(field);
    expect(tones(state)).toEqual(["professional"]);
    expect(state.kind === "result" && state.versions[0]?.rows).toEqual([
      { kind: "unchanged", text: "Intro." },
      { kind: "rewritten", text: "Hey.", segment: 1, replace: "available" },
    ]);
    controller.receive(done(1, 1));
    state = controller.state(field);
    expect(state.kind === "result" && state.pending).toEqual([]);
    expect(statuses(state)).toEqual(["done", "available", "available", "available"]);
  });

  test("another tone is added to the kept result, on the same text and caret", () => {
    const { field, sent, controller } = setup();
    controller.request(field, "friendlier");
    controller.receive(tone("friendlier"));
    controller.receive(done(1, 1));
    field.caret = null; // the result stays usable wherever the caret went
    controller.request(field, "casual");
    expect(sent[1]).toMatchObject({ requestId: 2, text: field.text, caret: 10, tones: ["casual"] });
    controller.receive(tone("casual", 2));
    controller.receive(done(2, 1));
    expect(tones(controller.state(field))).toEqual(["casual", "friendlier"]);
    controller.request(field, "friendlier");
    expect(sent).toHaveLength(2);
  });

  test("a tone clicked while another is in flight asks for both, so neither is lost", () => {
    const { field, sent, controller } = setup();
    controller.request(field, "concise");
    controller.request(field, "professional");
    expect(sent[1]).toMatchObject({ requestId: 2, tones: ["professional", "concise"] });
    expect(statuses(controller.state(field))).toEqual([
      "loading",
      "available",
      "loading",
      "available",
    ]);
    controller.receive(tone("concise", 1)); // the superseded request: dropped
    expect(tones(controller.state(field))).toEqual([]);
    controller.receive(tone("professional", 2));
    controller.receive(tone("concise", 2));
    controller.receive(done(2, 2));
    expect(tones(controller.state(field))).toEqual(["professional", "concise"]);
  });

  test("a pending tone before one that arrived was skipped by the core", () => {
    const { field, controller } = setup();
    controller.request(field, "casual");
    controller.request(field, "friendlier");
    controller.receive(tone("friendlier", 2));
    const state = controller.state(field);
    expect(state.kind === "result" && state.pending).toEqual([]);
    expect(statuses(state)).toEqual(["available", "available", "available", "done"]);
    controller.fail("f1", 2);
  });

  test("labels follow the passage language once a tone has arrived", () => {
    const { field, controller } = setup();
    controller.request(field, "concise");
    controller.receive({ ...tone("concise"), language: "fr" });
    expect(controller.state(field).tones.map((b) => b.label)).toEqual([
      "Professionnel",
      "Décontracté",
      "Concis",
      "Plus chaleureux",
    ]);
    controller.fail("f1", 1);
  });

  test("drops replies to another request or version, and a result whose passage changed", () => {
    const { field, controller } = setup();
    controller.request(field, "professional");
    controller.receive(tone("professional", 9));
    controller.receive(tone("professional", 1, 2));
    expect(tones(controller.state(field))).toEqual([]);
    controller.receive(tone("professional"));
    field.text = "Intro. Hello thar.";
    expect(controller.state(field).kind).toBe("idle");
  });

  test("keeps the result across a blur, the panel closing and a refocus", () => {
    const { field, controller } = setup();
    controller.request(field, "professional");
    // Blur: the watcher closes the field; nothing tells the controller to forget it.
    controller.receive(tone("professional"));
    controller.receive(done(1, 1));
    controller.track(field, "f1", 4); // refocus sends a new version of the same text
    expect(tones(controller.state(field))).toEqual(["professional"]);
  });

  test("a tone that arrives unseen puts the ready marker until the panel shows it", () => {
    const { field, controller } = setup();
    controller.request(field, "professional");
    expect(controller.hasNews(field)).toBe(false);
    controller.receive(tone("professional"));
    expect(controller.hasNews(field)).toBe(true);
    controller.seen(field);
    expect(controller.hasNews(field)).toBe(false);
    field.text = "Changed. Hello there.";
    expect(controller.hasNews(field)).toBe(false);
  });

  test("a failure or a timeout ends the loading state, keeping tones already shown", async () => {
    const failed = setup();
    failed.controller.request(failed.field, "casual");
    failed.controller.fail("f1", 1);
    expect(failed.controller.state(failed.field).kind).toBe("idle");

    const partial = setup(undefined, undefined, 5);
    partial.controller.request(partial.field, "professional");
    partial.controller.request(partial.field, "casual");
    partial.controller.receive(tone("professional", 2));
    await Bun.sleep(20);
    const state = partial.controller.state(partial.field);
    expect(state.kind === "result" && state.pending).toEqual([]);
    expect(statuses(state)).toEqual(["done", "available", "available", "available"]);
  });

  test("keeps results for the last few fields only", () => {
    const { controller } = setup();
    const fields = Array.from({ length: MAX_KEPT_FIELDS + 1 }, (_, i) => {
      const field = { text: "Intro. Hello there.", caret: 10 };
      controller.track(field, `g${i}`, 1);
      controller.request(field, "concise");
      return field;
    });
    expect(controller.state(fields[0] as FakeField).kind).toBe("idle");
    expect(controller.state(fields[1] as FakeField).kind).toBe("result");
    for (const field of fields) controller.fail(`g${fields.indexOf(field)}`, undefined);
  });
});
