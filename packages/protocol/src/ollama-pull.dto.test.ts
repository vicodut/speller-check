import { describe, expect, test } from "bun:test";
import { OllamaModelName, OllamaPullView, PullRequest } from "./ollama-pull.dto";

describe("OllamaModelName", () => {
  test("takes the names `ollama pull` takes", () => {
    for (const name of [
      "qwen3",
      "qwen3:8b",
      "llama3.2:3b-instruct-q4_K_M",
      "library/smollm2:135m",
      "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M",
    ])
      expect(OllamaModelName.safeParse(name).success).toBe(true);
  });

  test("refuses paths, URLs, spaces, flags and empty parts", () => {
    for (const name of [
      "",
      "../etc/passwd",
      "a/../b",
      "http://x/y",
      "qwen3 8b",
      "-rf",
      "a//b",
      "a:",
      ":tag",
      "a/b/c/d/e/f",
      "q".repeat(201),
    ])
      expect(OllamaModelName.safeParse(name).success).toBe(false);
  });
});

describe("pull schemas", () => {
  test("a pull request holds only the model", () => {
    expect(PullRequest.safeParse({ model: "qwen3:8b" }).success).toBe(true);
    expect(PullRequest.safeParse({ model: "qwen3:8b", insecure: true }).success).toBe(false);
  });

  test("a pull view carries non-negative byte counts", () => {
    const view = {
      model: "qwen3:8b",
      step: "downloading" as const,
      completed: 5,
      total: 10,
      error: null,
    };
    expect(OllamaPullView.parse(view)).toEqual(view);
    expect(OllamaPullView.safeParse({ ...view, completed: -1 }).success).toBe(false);
  });
});
