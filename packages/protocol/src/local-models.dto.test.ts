import { describe, expect, test } from "bun:test";
import { ManifestEntry, ModelManifest } from "./local-models.dto";

const entry = {
  id: "qwen3-8b",
  kind: "model",
  name: "Qwen3 8B",
  file: "qwen3-8b.gguf",
  url: "https://example.com/m.gguf",
  sizeBytes: 100,
  sha256: "a".repeat(64),
  ramBytes: 200,
  fixtureScore: { passed: 19, total: 20 },
};
const manifest = (...entries: unknown[]) => ({ version: 1, entries });

describe("ModelManifest", () => {
  test("accepts a valid manifest", () => {
    expect(ModelManifest.safeParse(manifest(entry)).success).toBe(true);
  });

  test("accepts a server entry without RAM and an unbenchmarked model", () => {
    const server = { ...entry, id: "llama-server", kind: "server", file: "s.tgz", ramBytes: null };
    const loose = { ...entry, id: "other", file: "o.gguf", fixtureScore: null };
    expect(ModelManifest.safeParse(manifest(entry, server, loose)).success).toBe(true);
  });

  test.each([
    ["http url", { url: "http://example.com/m.gguf" }],
    ["file url", { url: "file:///etc/passwd" }],
    ["not a url", { url: "nonsense" }],
    ["path in file name", { file: "../evil.gguf" }],
    ["slash in file name", { file: "a/b.gguf" }],
    ["short hash", { sha256: "abc" }],
    ["uppercase hash", { sha256: "A".repeat(64) }],
    ["zero size", { sizeBytes: 0 }],
    ["unknown field", { extra: 1 }],
    ["bad id", { id: "Qwen 3" }],
  ])("rejects %s", (_name, patch) => {
    expect(ManifestEntry.safeParse({ ...entry, ...patch }).success).toBe(false);
  });

  test("rejects duplicate ids or files, an empty list and a second server", () => {
    expect(ModelManifest.safeParse(manifest(entry, { ...entry, file: "x.gguf" })).success).toBe(
      false,
    );
    expect(ModelManifest.safeParse(manifest(entry, { ...entry, id: "b" })).success).toBe(false);
    expect(ModelManifest.safeParse(manifest()).success).toBe(false);
    const a = { ...entry, kind: "server", ramBytes: null };
    const b = { ...a, id: "b", file: "b.gguf" };
    expect(ModelManifest.safeParse(manifest(a, b)).success).toBe(false);
  });
});
