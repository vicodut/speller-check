import { describe, expect, test } from "bun:test";
import { pendingAfterTone, toneButtons, toneLabel, tonesToRequest } from "./tone-picker.model";

describe("tonesToRequest", () => {
  test("a first click asks for that tone only", () => {
    expect(tonesToRequest([], [], "concise")).toEqual(["concise"]);
  });

  test("another tone while one is in flight asks for both, in display order", () => {
    expect(tonesToRequest([], ["friendlier"], "casual")).toEqual(["casual", "friendlier"]);
  });

  test("tones already shown are not asked again", () => {
    expect(tonesToRequest(["professional"], ["concise"], "casual")).toEqual(["casual", "concise"]);
  });

  test("a tone already shown or in flight asks for nothing", () => {
    expect(tonesToRequest(["casual"], [], "casual")).toBeUndefined();
    expect(tonesToRequest([], ["casual"], "casual")).toBeUndefined();
  });
});

describe("pendingAfterTone", () => {
  test("drops the tone that arrived", () => {
    expect(pendingAfterTone(["casual", "concise"], "casual")).toEqual(["concise"]);
  });

  test("tones before it were skipped by the core and never come", () => {
    expect(pendingAfterTone(["professional", "casual", "concise"], "casual")).toEqual(["concise"]);
  });

  test("a tone not asked for leaves the pending ones alone", () => {
    expect(pendingAfterTone(["friendlier"], "professional")).toEqual(["friendlier"]);
  });
});

describe("toneButtons", () => {
  test("one button per tone in display order, each with its status", () => {
    expect(toneButtons("en", ["concise"], ["casual"])).toEqual([
      { tone: "professional", label: "Professional", status: "available" },
      { tone: "casual", label: "Casual", status: "loading" },
      { tone: "concise", label: "Concise", status: "done" },
      { tone: "friendlier", label: "Friendlier", status: "available" },
    ]);
  });

  test("French labels for a French passage", () => {
    expect(toneButtons("fr", [], []).map((b) => b.label)).toEqual([
      "Professionnel",
      "Décontracté",
      "Concis",
      "Plus chaleureux",
    ]);
    expect(toneLabel("fr", "concise")).toBe("Concis");
  });
});
