import { describe, expect, test } from "bun:test";
import { probeErrorText, testPassedText } from "./probe-text.util";

describe("probe texts", () => {
  test("a passed test shows its time in seconds", () => {
    expect(testPassedText(1234)).toBe("OK, 1.2 s");
    expect(testPassedText(80)).toBe("OK, 0.1 s");
  });

  test("errors read as short words; an endpoint error shows its status", () => {
    expect(probeErrorText("key_rejected", 401)).toBe("key rejected");
    expect(probeErrorText("endpoint_error", 402)).toBe("HTTP 402");
    expect(probeErrorText("auth_failed")).toBe("auth_failed");
  });
});
