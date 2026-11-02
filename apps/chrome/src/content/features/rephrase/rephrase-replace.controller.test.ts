import { describe, expect, test } from "bun:test";
import { done, setup, tone } from "./rephrase-controller.fixture";

describe("RephraseController Replace", () => {
  /** A field with a result: Professional rewrites "Hello there.", Casual merges both. */
  const withResult = () => {
    const t = setup();
    t.controller.request(t.field);
    t.controller.receive(tone("professional"));
    const casual = tone("casual");
    t.controller.receive({ ...casual, segments: [{ from: 0, to: 1, text: "Hi, all." }] });
    t.controller.receive(done(1, 2));
    return t;
  };
  const view = (t: ReturnType<typeof setup>) => {
    const state = t.controller.state(t.field);
    if (state.kind !== "result") throw new Error("no result");
    return state;
  };

  test("Replace writes one part; the view follows the new text", async () => {
    const t = withResult();
    await t.controller.replace(t.field, "professional", 1);
    expect(t.field.text).toBe("Intro. Hey.");
    expect(t.writes.applied).toEqual([
      { start: 7, end: 19, original: "Hello there.", suggestion: "Hey." },
    ]);
    const [professional, casual] = view(t).versions;
    expect(professional?.rows[1]).toMatchObject({ replace: "applied" });
    expect(professional?.replaceAll).toBe(false);
    expect(casual?.rows[0]).toMatchObject({ replace: "available" });
  });

  test("kept parts have no Replace; a replaced part is not written twice", async () => {
    const t = withResult();
    await t.controller.replace(t.field, "professional", 0);
    await t.controller.replace(t.field, "professional", 1);
    await t.controller.replace(t.field, "professional", 1);
    expect(t.writes.applied).toHaveLength(1);
  });

  test("parts from different versions apply one after another", async () => {
    const t = withResult();
    await t.controller.replace(t.field, "professional", 1);
    await t.controller.replace(t.field, "casual", 0);
    expect(t.field.text).toBe("Hi, all.");
    const [professional, casual] = view(t).versions;
    expect(casual?.rows[0]).toMatchObject({ replace: "applied" });
    expect(professional?.rows[1]).toMatchObject({ replace: "blocked" });
    await t.controller.replace(t.field, "professional");
    expect(t.field.text).toBe("Intro. Hey.");
  });

  test("Replace all writes the whole passage in one edit", async () => {
    const t = setup("Intro. Hello there. Bye.", 10);
    t.controller.request(t.field);
    t.controller.receive({
      ...tone("concise"),
      passage: { start: 0, end: 24 },
      sentences: [...tone("concise").sentences, { text: "Bye.", start: 20, end: 24 }],
      segments: [
        { from: 0, to: 0, text: "Hi." },
        { from: 1, to: 1, keep: true },
        { from: 2, to: 2, text: "Ciao." },
      ],
    });
    await t.controller.replace(t.field, "concise");
    expect(t.writes.applied).toEqual([
      {
        start: 0,
        end: 24,
        original: "Intro. Hello there. Bye.",
        suggestion: "Hi. Hello there. Ciao.",
      },
    ]);
    expect(view(t).versions[0]?.replaceAll).toBe(false);
  });

  test("never writes over changed text: a stale result is dropped", async () => {
    const t = withResult();
    t.field.text = "Intro. Hello thar.";
    await t.controller.replace(t.field, "professional", 1);
    expect(t.writes.applied).toEqual([]);
    expect(t.controller.state(t.field).kind).toBe("idle");
  });

  test("an edit after a Replace that changes the passage drops the result", async () => {
    const t = withResult();
    await t.controller.replace(t.field, "professional", 1);
    t.field.text = "Intro. Hey!";
    expect(t.controller.state(t.field).kind).toBe("idle");
  });

  test("a failed write-back offers the text to copy; a later success clears it", async () => {
    const t = withResult();
    t.writes.fails = true;
    await t.controller.replace(t.field, "professional", 1);
    expect(view(t).copy).toBe("Hey.");
    expect(view(t).versions[0]?.rows[1]).toMatchObject({ replace: "available" });
    t.writes.fails = false;
    await t.controller.replace(t.field, "professional", 1);
    expect(view(t).copy).toBeUndefined();
  });
});
