import { describe, expect, test } from "bun:test";
import { tokenAction } from "./token.command";

describe("tokenAction", () => {
  test("prints with no argument and rotates with --rotate", () => {
    expect(tokenAction([])).toBe("print");
    expect(tokenAction(["--rotate"])).toBe("rotate");
  });

  test("refuses anything else, so a typo never rotates or prints by accident", () => {
    expect(tokenAction(["--rotat"])).toBeNull();
    expect(tokenAction(["--rotate", "now"])).toBeNull();
    expect(tokenAction(["rotate"])).toBeNull();
  });
});
