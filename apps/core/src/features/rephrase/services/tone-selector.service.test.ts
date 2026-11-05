import { describe, expect, test } from "bun:test";
import { selectTones } from "./tone-selector.service";

describe("selectTones", () => {
  test("all four in display order when none are asked for", () => {
    expect(selectTones(undefined)).toEqual(["professional", "casual", "concise", "friendlier"]);
  });

  test("only the tones asked for, always in display order", () => {
    expect(selectTones(["casual"])).toEqual(["casual"]);
    expect(selectTones(["friendlier", "professional"])).toEqual(["professional", "friendlier"]);
  });
});
