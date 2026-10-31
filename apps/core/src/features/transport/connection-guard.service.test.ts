import { describe, expect, test } from "bun:test";
import { isAllowedOrigin, tokensMatch } from "./connection-guard.service";

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
