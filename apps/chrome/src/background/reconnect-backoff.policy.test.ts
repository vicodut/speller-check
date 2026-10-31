import { describe, expect, test } from "bun:test";
import { BACKOFF_CAP_MS, reconnectDelay } from "./reconnect-backoff.policy";

describe("reconnectDelay", () => {
  test("doubles from the base delay", () => {
    expect([0, 1, 2, 3].map((attempt) => reconnectDelay(attempt, 100, 10_000))).toEqual([
      100, 200, 400, 800,
    ]);
  });

  test("is capped", () => {
    expect(reconnectDelay(10, 500, 30_000)).toBe(30_000);
    expect(reconnectDelay(1_000)).toBe(BACKOFF_CAP_MS);
  });

  test("treats negative or fractional attempts safely", () => {
    expect(reconnectDelay(-3, 100, 1_000)).toBe(100);
    expect(reconnectDelay(1.7, 100, 1_000)).toBe(200);
  });
});
