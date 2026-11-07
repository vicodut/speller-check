import { describe, expect, test } from "bun:test";
import { takeToken } from "./page-token.util";

describe("takeToken", () => {
  test("takes the token from the link's fragment and asks to clear it", () => {
    expect(takeToken("#token=abc123", null)).toEqual({ token: "abc123", clearHash: true });
  });

  test("a fresh link wins over a stored token (after core token --rotate)", () => {
    expect(takeToken("#token=new", "old")).toEqual({ token: "new", clearHash: true });
  });

  test("without a fragment, reuses the stored token", () => {
    expect(takeToken("", "abc123")).toEqual({ token: "abc123", clearHash: false });
  });

  test("no fragment and nothing stored: no token", () => {
    expect(takeToken("", null)).toEqual({ token: null, clearHash: false });
    expect(takeToken("#token=", null)).toEqual({ token: null, clearHash: true });
  });

  test("ignores other fragments", () => {
    expect(takeToken("#section", "abc")).toEqual({ token: "abc", clearHash: false });
  });
});
