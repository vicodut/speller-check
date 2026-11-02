import { describe, expect, test } from "bun:test";
import type { RephraseVersion } from "@gc/protocol";
import { isVersionApplied, segmentStatus, versionRuns } from "./rephrase-replace.model";

const part = (from: number, to: number, text: string) => ({ from, to, text });

describe("segmentStatus", () => {
  test("a rewritten part is available while nothing touches it", () => {
    expect(segmentStatus(part(1, 1, "B."), [])).toBe("available");
    expect(segmentStatus(part(1, 1, "B."), [part(0, 0, "A."), part(2, 3, "C.")])).toBe("available");
  });

  test("the part the field holds is applied", () => {
    expect(segmentStatus(part(1, 2, "B."), [part(1, 2, "B.")])).toBe("applied");
  });

  test("a part covering replaced parts can overwrite them", () => {
    expect(segmentStatus(part(0, 2, "All."), [part(1, 1, "x"), part(2, 2, "y")])).toBe("available");
    expect(segmentStatus(part(1, 1, "Other."), [part(1, 1, "B.")])).toBe("available");
  });

  test("a part straddling a replaced part's edge is blocked", () => {
    expect(segmentStatus(part(1, 1, "B."), [part(0, 1, "AB.")])).toBe("blocked");
    expect(segmentStatus(part(1, 2, "BC."), [part(2, 3, "CD.")])).toBe("blocked");
  });
});

describe("versionRuns and isVersionApplied", () => {
  const version: RephraseVersion = {
    tone: "casual",
    segments: [
      { from: 0, to: 1, text: "AB." },
      { from: 2, to: 2, keep: true },
      { from: 3, to: 3, text: "D." },
    ],
  };

  test("a version's runs are its rewritten parts", () => {
    expect(versionRuns(version)).toEqual([part(0, 1, "AB."), part(3, 3, "D.")]);
  });

  test("a version is applied when the field holds exactly its parts", () => {
    expect(isVersionApplied(version, [])).toBe(false);
    expect(isVersionApplied(version, [part(0, 1, "AB.")])).toBe(false);
    expect(isVersionApplied(version, [part(3, 3, "D."), part(0, 1, "AB.")])).toBe(true);
    expect(isVersionApplied(version, [part(0, 1, "AB."), part(2, 2, "x"), part(3, 3, "D.")])).toBe(
      false,
    );
  });
});
