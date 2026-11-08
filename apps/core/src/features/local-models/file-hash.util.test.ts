import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256File } from "./file-hash.util";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gc-hash-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

test("hashes a file as lowercase hex SHA-256", async () => {
  const path = join(dir, "abc");
  await writeFile(path, "abc");
  expect(await sha256File(path)).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("hashes an empty file", async () => {
  const path = join(dir, "empty");
  await writeFile(path, "");
  expect(await sha256File(path)).toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});
