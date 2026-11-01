import { describe, expect, test } from "bun:test";
import { IssueType } from "@gc/protocol";
import { colourForType } from "./issue-colour.util";

describe("colourForType", () => {
  test("spelling is red and grammar is blue", () => {
    expect(colourForType("spelling")).toBe("#e5484d");
    expect(colourForType("grammar")).toBe("#3e63dd");
  });

  test("every type has its own colour", () => {
    const colours = IssueType.options.map(colourForType);
    expect(new Set(colours).size).toBe(IssueType.options.length);
  });
});
