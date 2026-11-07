import { describe, expect, test } from "bun:test";
import { ModelsProbe, ModelsResult, TestProbe, TestResult } from "./profile-probe.dto";

const endpoint = { profileId: null, baseUrl: "https://openrouter.ai/api/v1" };

describe("probe requests", () => {
  test("a draft endpoint needs an http(s) base URL; the key is optional", () => {
    expect(ModelsProbe.safeParse(endpoint).success).toBe(true);
    expect(ModelsProbe.safeParse({ ...endpoint, apiKey: null }).success).toBe(true);
    expect(ModelsProbe.safeParse({ ...endpoint, baseUrl: "file:///etc" }).success).toBe(false);
    expect(ModelsProbe.safeParse({ ...endpoint, apiKey: "has space" }).success).toBe(false);
  });

  test("a test needs a model", () => {
    const probe = { ...endpoint, model: "qwen/qwen3.8-flash", reasoningEffort: "none" };
    expect(TestProbe.safeParse(probe).success).toBe(true);
    expect(TestProbe.safeParse({ ...probe, model: " " }).success).toBe(false);
  });
});

describe("probe results", () => {
  test("carry models or ms on success, an error code (and maybe a status) on failure", () => {
    expect(ModelsResult.safeParse({ ok: true, models: ["a"] }).success).toBe(true);
    expect(TestResult.safeParse({ ok: true, ms: 1200 }).success).toBe(true);
    const failure = { ok: false, error: "endpoint_error", status: 402 };
    expect(TestResult.safeParse(failure).success).toBe(true);
    expect(ModelsResult.safeParse({ ok: false, error: "nope" }).success).toBe(false);
  });
});
