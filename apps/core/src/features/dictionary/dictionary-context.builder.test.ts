import { describe, expect, test } from "bun:test";
import { buildDictionaryContext, relevantEntries } from "./dictionary-context.builder";
import type { DictionaryEntry } from "./dictionary-entry.schema";

const entries: DictionaryEntry[] = [
  { term: "NestJS", note: "framework" },
  { term: "Zod" },
  { term: "kubectl", caseInsensitive: true },
];

describe("relevantEntries", () => {
  test("keeps only terms present in the text", () => {
    expect(relevantEntries(entries, "J'utilise NestJS et Kubectl.").map((e) => e.term)).toEqual([
      "NestJS",
      "kubectl",
    ]);
  });

  test("returns nothing for text without terms", () => {
    expect(relevantEntries(entries, "Plain sentence.")).toEqual([]);
  });
});

describe("buildDictionaryContext", () => {
  test("lists one term per line with its note", () => {
    expect(buildDictionaryContext(entries.slice(0, 2))).toBe("- NestJS (framework)\n- Zod");
  });

  test("is empty without entries", () => {
    expect(buildDictionaryContext([])).toBe("");
  });
});
