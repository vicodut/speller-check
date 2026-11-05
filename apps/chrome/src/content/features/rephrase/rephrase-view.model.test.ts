import { describe, expect, test } from "bun:test";
import type { RephraseToneResult } from "@gc/protocol";
import { addTone, buildRephraseView, type RephraseDraft } from "./rephrase-view.model";

const located = {
  passage: { start: 6, end: 22 },
  sentences: [
    { text: "One.", start: 6, end: 10 },
    { text: "Two.", start: 11, end: 15 },
    { text: "Three.", start: 16, end: 22 },
  ],
};

const draft = (overrides: Partial<RephraseDraft> = {}): RephraseDraft => ({
  ...located,
  language: "en",
  versions: [
    {
      tone: "casual",
      segments: [
        { from: 0, to: 1, text: "One and two." },
        { from: 2, to: 2, keep: true },
      ],
    },
    { tone: "concise", segments: [{ from: 0, to: 2, keep: true }] },
  ],
  ...overrides,
});

const tone = (
  name: RephraseToneResult["tone"],
  language: "en" | "fr" = "en",
): RephraseToneResult => ({
  ...located,
  language,
  tone: name,
  segments: [{ from: 0, to: 2, keep: true }],
});

describe("buildRephraseView", () => {
  test("one block per version, rewritten rows and faded unchanged rows in order", () => {
    const view = buildRephraseView(draft());
    expect(view[0]).toEqual({
      tone: "casual",
      label: "Casual",
      fits: false,
      replaceAll: true,
      rows: [
        { kind: "rewritten", text: "One and two.", segment: 0, replace: "available" },
        { kind: "unchanged", text: "Three." },
      ],
    });
  });

  test("replaced parts set each Replace button and Replace all", () => {
    const [casual, concise] = buildRephraseView(draft(), [
      { from: 0, to: 1, text: "One and two." },
    ]);
    expect(casual?.rows[0]).toMatchObject({ replace: "applied" });
    expect(casual?.replaceAll).toBe(false);
    expect(concise?.replaceAll).toBe(false);
    const [blocked] = buildRephraseView(draft(), [{ from: 1, to: 2, text: "x" }]);
    expect(blocked?.rows[0]).toMatchObject({ replace: "blocked" });
    expect(blocked?.replaceAll).toBe(true);
  });

  test("a version that keeps everything already fits the tone", () => {
    const concise = buildRephraseView(draft())[1];
    expect(concise?.fits).toBe(true);
    expect(concise?.rows).toEqual([{ kind: "unchanged", text: "One. Two. Three." }]);
  });

  test("labels follow the passage language", () => {
    const all = (["professional", "casual", "concise", "friendlier"] as const).reduce<
      RephraseDraft | undefined
    >((d, name) => addTone(d, tone(name, "fr")), undefined);
    if (!all) throw new Error("no draft");
    const labels = (language: "en" | "fr") =>
      buildRephraseView({ ...all, language }).map((v) => v.label);
    expect(labels("en")).toEqual(["Professional", "Casual", "Concise", "Friendlier"]);
    expect(labels("fr")).toEqual(["Professionnel", "Décontracté", "Concis", "Plus chaleureux"]);
  });
});

describe("addTone", () => {
  test("the first tone starts the draft with its passage and language", () => {
    const first = addTone(undefined, tone("concise", "fr"));
    expect(first.versions.map((v) => v.tone)).toEqual(["concise"]);
    expect(first.language).toBe("fr");
  });

  test("versions stay in display order whatever order they arrive in", () => {
    const later = addTone(addTone(undefined, tone("friendlier")), tone("casual"));
    expect(later.versions.map((v) => v.tone)).toEqual(["casual", "friendlier"]);
  });
});
