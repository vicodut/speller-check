import { describe, expect, test } from "bun:test";
import type { RephraseResult } from "@gc/protocol";
import { buildRephraseView, isPassageCurrent } from "./rephrase-view.model";

const result = (overrides: Partial<RephraseResult> = {}): RephraseResult => ({
  passage: { start: 6, end: 22 },
  sentences: [
    { text: "One.", start: 6, end: 10 },
    { text: "Two.", start: 11, end: 15 },
    { text: "Three.", start: 16, end: 22 },
  ],
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

describe("buildRephraseView", () => {
  test("one block per version, rewritten rows and faded unchanged rows in order", () => {
    const view = buildRephraseView(result());
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
    const concise = buildRephraseView(result())[1];
    expect(concise?.fits).toBe(true);
    expect(concise?.rows).toEqual([{ kind: "unchanged", text: "One. Two. Three." }]);
  });

  test("labels follow the passage language", () => {
    const tones = [
      { tone: "professional" as const, segments: [{ from: 0, to: 2, keep: true as const }] },
      { tone: "casual" as const, segments: [{ from: 0, to: 2, keep: true as const }] },
      { tone: "concise" as const, segments: [{ from: 0, to: 2, keep: true as const }] },
      { tone: "friendlier" as const, segments: [{ from: 0, to: 2, keep: true as const }] },
    ];
    const labels = (language: "en" | "fr") =>
      buildRephraseView(result({ language, versions: tones })).map((v) => v.label);
    expect(labels("en")).toEqual(["Professional", "Casual", "Concise", "Friendlier"]);
    expect(labels("fr")).toEqual(["Professionnel", "Décontracté", "Concis", "Plus chaleureux"]);
  });
});

describe("isPassageCurrent", () => {
  test("is true while the passage text is unchanged, even after edits elsewhere", () => {
    const sent = "Hello One. Two. Three.";
    expect(isPassageCurrent(result(), sent, sent)).toBe(true);
    expect(isPassageCurrent(result(), sent, `${sent} More text.`)).toBe(true);
    expect(isPassageCurrent(result(), sent, "Hello One. Too. Three.")).toBe(false);
    expect(isPassageCurrent(result(), sent, `Oh ${sent}`)).toBe(false);
  });
});
