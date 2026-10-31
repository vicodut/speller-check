import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("JsonDictionaryRepository.add", () => {
  test("creates the file and its parent dir when missing", async () => {
    const path = join(dir, "new", "dict.json");
    const repo = new JsonDictionaryRepository(path);
    expect(await repo.add("NestJS")).toEqual({ ok: true, value: undefined });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ entries: [{ term: "NestJS" }] });
  });

  test("appends after existing entries and keeps their fields", async () => {
    const path = fileWith("append.json", JSON.stringify({ entries: [{ term: "Bun", note: "n" }] }));
    const repo = new JsonDictionaryRepository(path);
    await repo.add("  Zod ");
    expect(await repo.load()).toEqual({
      ok: true,
      value: [{ term: "Bun", note: "n" }, { term: "Zod" }],
    });
  });

  test("does not duplicate an existing term, but treats case as distinct", async () => {
    const path = fileWith("dup.json", JSON.stringify({ entries: [{ term: "Bun" }] }));
    const repo = new JsonDictionaryRepository(path);
    await repo.add("Bun");
    await repo.add("bun");
    expect(await repo.load()).toEqual({ ok: true, value: [{ term: "Bun" }, { term: "bun" }] });
  });

  test("keeps every term when adds run concurrently", async () => {
    const repo = new JsonDictionaryRepository(join(dir, "concurrent.json"));
    await Promise.all(["a", "b", "c"].map((term) => repo.add(term)));
    expect(await repo.load()).toEqual({
      ok: true,
      value: [{ term: "a" }, { term: "b" }, { term: "c" }],
    });
  });

  test("leaves no temp file behind", async () => {
    const sub = join(dir, "clean");
    await new JsonDictionaryRepository(join(sub, "dict.json")).add("NestJS");
    expect(readdirSync(sub)).toEqual(["dict.json"]);
  });

  test("refuses to overwrite an invalid file", async () => {
    const path = fileWith("broken.json", "{ entries: ");
    expect(await new JsonDictionaryRepository(path).add("x")).toEqual({
      ok: false,
      error: { code: "dictionary_invalid" },
    });
    expect(readFileSync(path, "utf8")).toBe("{ entries: ");
  });

  test("fails with dictionary_write_failed when the directory can't be created", async () => {
    const blocker = fileWith("blocker", "");
    const repo = new JsonDictionaryRepository(join(blocker, "dict.json"));
    expect(await repo.add("x")).toEqual({ ok: false, error: { code: "dictionary_write_failed" } });
  });
});
