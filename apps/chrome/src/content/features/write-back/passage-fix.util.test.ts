import { describe, expect, test } from "bun:test";
import { expectedTextAfterFix, matchesText } from "./fix-text.util";
import {
  holdsPassage,
  type PassageBase,
  passageWithRuns,
  replacePassageFix,
  replaceRunFix,
} from "./passage-fix.util";

const TEXT = "Intro.\n\nOne here.  Two there.\nThree. After.";
const sentence = (s: string) => ({ start: TEXT.indexOf(s), end: TEXT.indexOf(s) + s.length });
const base: PassageBase = {
  text: TEXT,
  passage: { start: TEXT.indexOf("One"), end: TEXT.indexOf("Three.") + 6 },
  sentences: [sentence("One here."), sentence("Two there."), sentence("Three.")],
};

/** Applies a fix to the text the way the field would, checking it targets the expected text. */
const apply = (text: string, fix: ReturnType<typeof replaceRunFix>["fix"]) => {
  expect(matchesText(text, fix)).toBe(true);
  return expectedTextAfterFix(text, fix);
};

describe("replaceRunFix", () => {
  test("replaces one rewritten part over its sentences only", () => {
    const { fix, runs } = replaceRunFix(base, [], { from: 1, to: 1, text: "Second." });
    expect(fix).toEqual({
      ...sentence("Two there."),
      original: "Two there.",
      suggestion: "Second.",
    });
    expect(apply(TEXT, fix)).toBe("Intro.\n\nOne here.  Second.\nThree. After.");
    expect(runs).toEqual([{ from: 1, to: 1, text: "Second." }]);
  });

  test("parts applied one after another land at shifted offsets", () => {
    const first = replaceRunFix(base, [], { from: 0, to: 0, text: "1." });
    let text = apply(TEXT, first.fix);
    const second = replaceRunFix(base, first.runs, { from: 2, to: 2, text: "Third and last." });
    text = apply(text, second.fix);
    expect(text).toBe("Intro.\n\n1.  Two there.\nThird and last. After.");
    expect(holdsPassage(base, second.runs, text)).toBe(true);
  });

  test("a merged part overwrites the parts it contains", () => {
    const first = replaceRunFix(base, [], { from: 1, to: 1, text: "Second." });
    const text = apply(TEXT, first.fix);
    const merged = replaceRunFix(base, first.runs, { from: 0, to: 1, text: "One and two." });
    expect(merged.fix.original).toBe("One here.  Second.");
    expect(apply(text, merged.fix)).toBe("Intro.\n\nOne and two.\nThree. After.");
    expect(merged.runs).toEqual([{ from: 0, to: 1, text: "One and two." }]);
  });
});

describe("replacePassageFix", () => {
  const version = [
    { from: 0, to: 1, text: "Both." },
    { from: 2, to: 2, text: "3." },
  ];

  test("replaces the whole passage in one edit, keeping the space between parts", () => {
    const { fix, runs } = replacePassageFix(base, [], [{ from: 0, to: 0, text: "1." }]);
    expect(fix.start).toBe(base.passage.start);
    expect(fix.end).toBe(base.passage.end);
    expect(apply(TEXT, fix)).toBe("Intro.\n\n1.  Two there.\nThree. After.");
    expect(runs).toEqual([{ from: 0, to: 0, text: "1." }]);
    expect(apply(TEXT, replacePassageFix(base, [], version).fix)).toBe(
      "Intro.\n\nBoth.\n3. After.",
    );
  });

  test("after a part from another version, the whole passage becomes this version", () => {
    const part = replaceRunFix(base, [], { from: 1, to: 1, text: "Second, longer." });
    const text = apply(TEXT, part.fix);
    const all = replacePassageFix(base, part.runs, version);
    expect(all.fix.original).toBe("One here.  Second, longer.\nThree.");
    expect(apply(text, all.fix)).toBe("Intro.\n\nBoth.\n3. After.");
  });
});

describe("holdsPassage", () => {
  test("true while the field holds the passage, with replaced parts, at its offsets", () => {
    expect(holdsPassage(base, [], TEXT)).toBe(true);
    expect(holdsPassage(base, [], `${TEXT} More.`)).toBe(true);
    expect(holdsPassage(base, [], TEXT.replace("Two", "Too"))).toBe(false);
    expect(holdsPassage(base, [], `X${TEXT}`)).toBe(false);
    const runs = [{ from: 1, to: 1, text: "2." }];
    expect(holdsPassage(base, runs, TEXT)).toBe(false);
    expect(holdsPassage(base, runs, TEXT.replace("Two there.", "2."))).toBe(true);
  });

  test("passageWithRuns keeps the base passage when nothing is replaced", () => {
    expect(passageWithRuns(base, [])).toBe("One here.  Two there.\nThree.");
  });
});
