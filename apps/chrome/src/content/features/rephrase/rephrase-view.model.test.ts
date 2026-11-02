import { describe, expect, test } from "bun:test";
import type { RephraseToneResult } from "@gc/protocol";
import {
  addTone,
  buildRephraseView,
  isPassageCurrent,
  pendingToneLabels,
  type RephraseDraft,
} from "./rephrase-view.model";

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
      rows: [
        { kind: "rewritten", text: "One and two." },
        { kind: "unchanged", text: "Three." },
      ],
    });
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

describe("addTone and pendingToneLabels", () => {
  test("tones arrive one by one; the rest are pending", () => {
    expect(pendingToneLabels(undefined)).toEqual([
      "Professional",
      "Casual",
      "Concise",
      "Friendlier",
    ]);
    const first = addTone(undefined, tone("professional", "fr"));
    expect(first.versions.map((v) => v.tone)).toEqual(["professional"]);
    expect(pendingToneLabels(first)).toEqual(["Décontracté", "Concis", "Plus chaleureux"]);
  });

  test("a tone the core skipped is no longer pending once a later one arrived", () => {
    const later = addTone(addTone(undefined, tone("professional")), tone("concise"));
    expect(later.versions.map((v) => v.tone)).toEqual(["professional", "concise"]);
    expect(pendingToneLabels(later)).toEqual(["Friendlier"]);
  });
});

describe("isPassageCurrent", () => {
  test("is true while the passage text is unchanged, even after edits elsewhere", () => {
    const sent = "Hello One. Two. Three.";
    expect(isPassageCurrent(draft(), sent, sent)).toBe(true);
    expect(isPassageCurrent(draft(), sent, `${sent} More text.`)).toBe(true);
    expect(isPassageCurrent(draft(), sent, "Hello One. Too. Three.")).toBe(false);
    expect(isPassageCurrent(draft(), sent, `Oh ${sent}`)).toBe(false);
  });
});
