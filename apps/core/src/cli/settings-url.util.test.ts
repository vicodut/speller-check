import { describe, expect, test } from "bun:test";
import { settingsUrl } from "./settings-url.util";

describe("settingsUrl", () => {
  test("points at the core on 127.0.0.1 with the token in the fragment", () => {
    expect(settingsUrl(7341, "abc_-123")).toBe("http://127.0.0.1:7341/settings#token=abc_-123");
  });

  test("never puts the token in the query string", () => {
    expect(new URL(settingsUrl(7341, "abc")).search).toBe("");
  });
});
