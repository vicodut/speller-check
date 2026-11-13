import { describe, expect, test } from "bun:test";
import { errorText } from "./error-text.util";

describe("errorText", () => {
  test("explains a known code", () => {
    expect(errorText("unreachable")).toBe("Can't reach the grammar checker core. Is it running?");
  });

  test("shows an unknown code as is", () => {
    expect(errorText("weird_code")).toBe("Something went wrong (weird_code).");
  });
});
