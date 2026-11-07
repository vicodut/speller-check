import { describe, expect, test } from "bun:test";
import { bearerToken, isLocalHost, isSameOrigin } from "./http-guard.util";

describe("isLocalHost", () => {
  test("accepts the core's own host on its port", () => {
    expect(isLocalHost("127.0.0.1:7341", 7341)).toBe(true);
    expect(isLocalHost("localhost:7341", 7341)).toBe(true);
  });

  test("refuses another name pointing at 127.0.0.1 (DNS rebinding), another port, or none", () => {
    expect(isLocalHost("evil.example:7341", 7341)).toBe(false);
    expect(isLocalHost("127.0.0.1:8080", 7341)).toBe(false);
    expect(isLocalHost("127.0.0.1", 7341)).toBe(false);
    expect(isLocalHost(null, 7341)).toBe(false);
  });
});

describe("isSameOrigin", () => {
  test("accepts no Origin (curl, the CLI) and the core's own page", () => {
    expect(isSameOrigin(null, 7341)).toBe(true);
    expect(isSameOrigin("http://127.0.0.1:7341", 7341)).toBe(true);
    expect(isSameOrigin("http://localhost:7341", 7341)).toBe(true);
  });

  test("refuses any website and the extension", () => {
    expect(isSameOrigin("https://evil.example", 7341)).toBe(false);
    expect(isSameOrigin("http://127.0.0.1:8080", 7341)).toBe(false);
    expect(isSameOrigin(`chrome-extension://${"b".repeat(32)}`, 7341)).toBe(false);
  });
});

describe("bearerToken", () => {
  test("reads the token from an Authorization header", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
  });

  test("is empty for anything else", () => {
    expect(bearerToken(null)).toBe("");
    expect(bearerToken("Basic abc")).toBe("");
    expect(bearerToken("Bearer ")).toBe("");
  });
});
