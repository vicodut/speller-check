import { describe, expect, test } from "bun:test";
import { httpFailure, thrownFailure } from "./probe-error.util";

describe("httpFailure", () => {
  test("401 and 403 mean the key was rejected", () => {
    expect(httpFailure(401, "")).toEqual({ ok: false, error: "key_rejected", status: 401 });
    expect(httpFailure(403, "{}")).toEqual({ ok: false, error: "key_rejected", status: 403 });
  });

  test("404 means the model is unknown", () => {
    expect(httpFailure(404, 'model "x" not found')).toMatchObject({ error: "unknown_model" });
  });

  test("a 400 that names an invalid model means the model is unknown", () => {
    const openRouter = '{"error":{"message":"qwen/nope is not a valid model ID","code":400}}';
    expect(httpFailure(400, openRouter)).toMatchObject({ error: "unknown_model" });
    expect(httpFailure(422, "The model `x` does not exist")).toMatchObject({
      error: "unknown_model",
    });
  });

  test("any other error is an endpoint error with its status", () => {
    const unsupported = "Unsupported parameter: 'max_tokens' is not supported with this model.";
    expect(httpFailure(400, unsupported)).toEqual({
      ok: false,
      error: "endpoint_error",
      status: 400,
    });
    expect(httpFailure(500, "")).toMatchObject({ error: "endpoint_error", status: 500 });
  });
});

describe("thrownFailure", () => {
  test("a timeout is a timeout; anything else thrown means unreachable", () => {
    const timeout = new DOMException("t", "TimeoutError");
    expect(thrownFailure(timeout)).toEqual({ ok: false, error: "timeout" });
    expect(thrownFailure(new TypeError("fetch failed"))).toEqual({
      ok: false,
      error: "unreachable",
    });
  });
});
