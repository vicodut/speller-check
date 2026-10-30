import { expect, test } from "bun:test";
import { hashSentence } from "./sentence-hasher.service";

test("hashes deterministically to hex sha256", () => {
  expect(hashSentence("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("distinguishes sentences that differ only by case or accent", () => {
  const hashes = new Set(["Il est parti.", "il est parti.", "Il est partie."].map(hashSentence));
  expect(hashes.size).toBe(3);
});
