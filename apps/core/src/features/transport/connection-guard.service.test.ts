import { describe, expect, test } from "bun:test";
import { currentToken, isAllowedOrigin, tokensMatch } from "./connection-guard.service";

describe("tokensMatch", () => {
  test("accepts the same token", () => {
    expect(tokensMatch("secret-token", "secret-token")).toBe(true);
  });

  test.each([
    ["different", "secret-tokeN"],
    ["shorter", "secret"],
    ["longer", "secret-token-2"],
    ["empty", ""],
  ])("rejects a %s token", (_name, given) => {
    expect(tokensMatch("secret-token", given)).toBe(false);
  });
});

describe("tokensMatch without a current token", () => {
  test("never matches when the token is missing or unreadable (fails closed)", () => {
    expect(tokensMatch(null, "")).toBe(false);
    expect(tokensMatch(null, "secret-token")).toBe(false);
    expect(tokensMatch("", "")).toBe(false);
  });
});

describe("currentToken", () => {
  test("reads a fixed token or asks a getter each time", () => {
    let token: string | null = "a";
    const getter = () => token;
    expect(currentToken("fixed")).toBe("fixed");
    expect(currentToken(getter)).toBe("a");
    token = "b";
    expect(currentToken(getter)).toBe("b");
  });
});

describe("isAllowedOrigin", () => {
  test("allows native clients (no Origin) and Chrome extensions", () => {
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin(`chrome-extension://${"a".repeat(32)}`)).toBe(true);
  });

  test.each([
    "https://example.com",
    "http://127.0.0.1:3000",
    "null",
    "",
    "chrome-extension://",
    `chrome-extension://${"a".repeat(32)}.evil.com`,
    `moz-extension://${"a".repeat(32)}`,
  ])("refuses origin %p", (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});
