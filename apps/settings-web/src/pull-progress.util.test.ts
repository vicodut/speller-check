import { describe, expect, test } from "bun:test";
import type { OllamaPullView } from "@gc/protocol";
import { formatBytes, isPulling, pullLabel } from "./pull-progress.util";

const pull = (over: Partial<OllamaPullView>): OllamaPullView => ({
  model: "smollm2:135m",
  step: "downloading",
  completed: 0,
  total: 0,
  error: null,
  ...over,
});

describe("formatBytes", () => {
  test("uses the largest unit that keeps a number ≥ 1, decimal like Ollama", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(270_900_000)).toBe("271 MB");
    expect(formatBytes(5_225_000_000)).toBe("5.2 GB");
  });
});

describe("pullLabel", () => {
  test("says what's going on, with bytes and percent while downloading", () => {
    expect(pullLabel(pull({ step: "starting" }))).toBe("Preparing…");
    expect(pullLabel(pull({ completed: 54_000_000, total: 270_900_000 }))).toBe(
      "54 MB of 271 MB · 19%",
    );
    expect(pullLabel(pull({ step: "verifying" }))).toBe("Verifying…");
  });
});

describe("isPulling", () => {
  test("only steps before done or failed", () => {
    expect(isPulling(null)).toBe(false);
    expect(isPulling(pull({ step: "starting" }))).toBe(true);
    expect(isPulling(pull({ step: "verifying" }))).toBe(true);
    expect(isPulling(pull({ step: "done" }))).toBe(false);
    expect(isPulling(pull({ step: "failed", error: "ollama_pull_failed" }))).toBe(false);
  });
});
