import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonDictionaryRepository } from "./dictionary.repository";

const dir = mkdtempSync(join(tmpdir(), "gc-dictionary-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const fileWith = (name: string, content: string) => {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
};

describe("JsonDictionaryRepository", () => {
  test("loads valid entries", async () => {
    const path = fileWith("ok.json", JSON.stringify({ entries: [{ term: "NestJS" }] }));
    expect(await new JsonDictionaryRepository(path).load()).toEqual({
      ok: true,
      value: [{ term: "NestJS" }],
    });
  });

  test("treats a missing file as an empty dictionary", async () => {
    const repo = new JsonDictionaryRepository(join(dir, "missing.json"));
    expect(await repo.load()).toEqual({ ok: true, value: [] });
  });

  test.each([
    ["malformed JSON", "{ entries: "],
    ["wrong shape", JSON.stringify({ entries: [{ word: "x" }] })],
  ])("fails with dictionary_invalid on %s", async (name, content) => {
    const repo = new JsonDictionaryRepository(fileWith(`${name}.json`, content));
    expect(await repo.load()).toEqual({ ok: false, error: { code: "dictionary_invalid" } });
  });
});
