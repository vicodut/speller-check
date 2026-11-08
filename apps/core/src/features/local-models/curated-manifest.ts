import type { ModelManifest } from "@gc/protocol";
import { parseManifest } from "./manifest.util";

const GIB = 1024 ** 3;

/**
 * The manifest of this release (2026-11-08, #40). Fixed in the repo: the core never fetches a
 * remote one. Sizes and SHA-256 are the files' real values (Hugging Face's LFS metadata for the
 * models at a pinned commit; GitHub's release digest for llama.cpp). `ramBytes` is an estimate
 * (weights plus context cache), not measured. `fixtureScore` comes from the fixture runs; null
 * means not benchmarked yet.
 */
const RAW_MANIFEST = {
  version: 1,
  entries: [
    {
      id: "qwen3-8b-q4_k_m",
      kind: "model",
      name: "Qwen3 8B (Q4_K_M)",
      file: "Qwen3-8B-Q4_K_M.gguf",
      url: "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/7c41481f57cb95916b40956ab2f0b139b296d974/Qwen3-8B-Q4_K_M.gguf",
      sizeBytes: 5027783488,
      sha256: "d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785",
      ramBytes: 8 * GIB,
      fixtureScore: { passed: 19, total: 20 },
    },
    {
      id: "qwen3-4b-q4_k_m",
      kind: "model",
      name: "Qwen3 4B (Q4_K_M)",
      file: "Qwen3-4B-Q4_K_M.gguf",
      url: "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/bc640142c66e1fdd12af0bd68f40445458f3869b/Qwen3-4B-Q4_K_M.gguf",
      sizeBytes: 2497280256,
      sha256: "7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5",
      ramBytes: 5 * GIB,
      fixtureScore: null,
    },
    {
      id: "llama-server",
      kind: "server",
      name: "llama-server b12207 (macOS, Apple silicon)",
      file: "llama-b12207-bin-macos-arm64.tar.gz",
      url: "https://github.com/ggml-org/llama.cpp/releases/download/b12207/llama-b12207-bin-macos-arm64.tar.gz",
      sizeBytes: 16708806,
      sha256: "1faf4a630ad03816128266ac0e58e70c70a6886d2483f3ccaa3c4d95c37640f5",
      ramBytes: null,
      fixtureScore: null,
    },
  ],
};

const parsed = parseManifest(RAW_MANIFEST);
if (!parsed.ok) throw new Error("curated manifest is invalid"); // programmer error, caught by tests

export const CURATED_MANIFEST: ModelManifest = parsed.value;
