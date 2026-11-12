import { describe, expect, test } from "bun:test";
import { modelLine } from "./model-line.util";

describe("modelLine", () => {
  test("says local or cloud", () => {
    expect(modelLine({ model: "qwen3:8b", local: true })).toBe("Model: qwen3:8b (local)");
    const cloud = { model: "qwen/qwen3.8-flash", local: false, provider: "openrouter.ai" };
    expect(modelLine(cloud)).toBe("Model: qwen/qwen3.8-flash (cloud)");
  });

  test("shows nothing until the core has said", () => {
    expect(modelLine(undefined)).toBeUndefined();
  });
});
