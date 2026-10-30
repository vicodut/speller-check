import { describe, expect, test } from "bun:test";
import { filterDictionaryTerms } from "./dictionary.filter";
import type { DictionaryEntry } from "./dictionary-entry.schema";

const entries: DictionaryEntry[] = [
  { term: "NestJS", note: "framework" },
  { term: "kubectl", caseInsensitive: true },
];
const issue = (original: string, suggestion: string) => ({ original, suggestion });

describe("filterDictionaryTerms", () => {
  test("drops an issue whose original is a term", () => {
    expect(filterDictionaryTerms([issue("NestJS", "Nest JS")], entries)).toEqual([]);
  });

  test("drops an issue that rewrites a term inside a longer original", () => {
    expect(filterDictionaryTerms([issue("NestJS app", "Nest.js app")], entries)).toEqual([]);
  });

  test("keeps a grammar fix that leaves the term intact", () => {
    const fix = issue("NestJS are", "NestJS is");
    expect(filterDictionaryTerms([fix], entries)).toEqual([fix]);
  });

  test("is case-sensitive by default", () => {
    const other = issue("nestjs", "NestJS");
    expect(filterDictionaryTerms([other], entries)).toEqual([other]);
  });

  test("honours caseInsensitive entries", () => {
    expect(filterDictionaryTerms([issue("Kubectl", "kubectl")], entries)).toEqual([]);
  });

  test("matches whole words only", () => {
    const partial = issue("NestJSX", "NestJS");
    expect(filterDictionaryTerms([partial], entries)).toEqual([partial]);
  });

  test("keeps unrelated issues", () => {
    const has = issue("has went", "has gone");
    expect(filterDictionaryTerms([has], entries)).toEqual([has]);
  });
});
