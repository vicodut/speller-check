import { describe, expect, test } from "bun:test";
import { forgetStoredToken, LEGACY_TOKEN_KEY, takeToken } from "./page-token.util";

/** A storage stub that records every call, so a test can prove nothing was written. */
const recordingStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  const calls: string[] = [];
  const storage = {
    getItem: (key: string) => {
      calls.push(`get:${key}`);
      return items.get(key) ?? null;
    },
    setItem: (key: string, _value: string) => {
      calls.push(`set:${key}`);
    },
    removeItem: (key: string) => {
      calls.push(`remove:${key}`);
      items.delete(key);
    },
  };
  return { storage, items, calls };
};

describe("takeToken", () => {
  test("takes the token from the link's fragment and asks to clear it", () => {
    expect(takeToken("#token=abc123")).toEqual({ token: "abc123", clearHash: true });
  });

  test("decodes the fragment", () => {
    expect(takeToken("#token=a%2Bb")).toEqual({ token: "a+b", clearHash: true });
  });

  test("a malformed escape gives no token but is still cleared, and does not throw", () => {
    expect(takeToken("#token=%E0%A4%A")).toEqual({ token: null, clearHash: true });
  });

  test("without a fragment there is no token, so the page asks for `core settings`", () => {
    expect(takeToken("")).toEqual({ token: null, clearHash: false });
  });

  test("an empty token fragment gives no token but is still cleared", () => {
    expect(takeToken("#token=")).toEqual({ token: null, clearHash: true });
  });

  test("ignores other fragments", () => {
    expect(takeToken("#section")).toEqual({ token: null, clearHash: false });
  });

  test("never reads or writes browser storage", () => {
    const { storage, calls } = recordingStorage({ [LEGACY_TOKEN_KEY]: "old" });
    const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    try {
      expect(takeToken("#token=abc").token).toBe("abc");
      expect(takeToken("").token).toBeNull();
    } finally {
      if (saved) Object.defineProperty(globalThis, "localStorage", saved);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
    expect(calls).toEqual([]);
  });
});

describe("forgetStoredToken", () => {
  test("removes the token an older page stored, and writes nothing", () => {
    const { storage, items, calls } = recordingStorage({ [LEGACY_TOKEN_KEY]: "old", other: "x" });
    forgetStoredToken(storage);
    expect(items.has(LEGACY_TOKEN_KEY)).toBe(false);
    expect(items.get("other")).toBe("x");
    expect(calls).toEqual([`remove:${LEGACY_TOKEN_KEY}`]);
  });

  test("the old key is the one the previous page used", () => {
    expect(LEGACY_TOKEN_KEY).toBe("gc.installToken");
  });

  test("is harmless when nothing is stored, so later loads are no-ops", () => {
    const { storage, items } = recordingStorage();
    forgetStoredToken(storage);
    forgetStoredToken(storage);
    expect(items.size).toBe(0);
  });

  test("tolerates blocked or missing storage", () => {
    const throwing = {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => forgetStoredToken(throwing)).not.toThrow();
    expect(() => forgetStoredToken(null)).not.toThrow();
  });
});
