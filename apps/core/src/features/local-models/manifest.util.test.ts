import { describe, expect, test } from "bun:test";
import { CURATED_MANIFEST } from "./curated-manifest";
import { parseManifest } from "./manifest.util";

describe("parseManifest", () => {
  test("accepts a valid manifest", () => {
    expect(parseManifest(CURATED_MANIFEST).ok).toBe(true);
  });

  test("answers manifest_invalid for anything else", () => {
    for (const raw of [null, "x", {}, { version: 2, entries: [] }]) {
      const result = parseManifest(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("manifest_invalid");
    }
  });
});

describe("the curated manifest shipped in the repo", () => {
  test("is valid, with 2 or 3 models and the llama-server build", () => {
    const entries = CURATED_MANIFEST.entries;
    expect(entries.filter((e) => e.kind === "model").length).toBeGreaterThanOrEqual(2);
    expect(entries.filter((e) => e.kind === "model").length).toBeLessThanOrEqual(3);
    expect(entries.filter((e) => e.kind === "server")).toHaveLength(1);
  });

  test("pins every download to an immutable URL", () => {
    for (const entry of CURATED_MANIFEST.entries) {
      expect(entry.url).not.toContain("/resolve/main/");
      expect(entry.url).not.toContain("/latest/");
    }
  });
});
