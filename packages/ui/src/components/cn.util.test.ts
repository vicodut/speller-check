import { describe, expect, test } from "bun:test";
import { cn } from "./cn.util";

describe("cn", () => {
  test("joins class names and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  test("takes conditional objects and arrays", () => {
    expect(cn({ a: true, b: false }, ["c", ["d"]])).toBe("a c d");
  });

  test("a later Tailwind class wins over a conflicting earlier one", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("bg-primary", "bg-destructive")).toBe("bg-destructive");
  });

  test("knows the theme's colour tokens", () => {
    expect(cn("text-muted-foreground", "text-success")).toBe("text-success");
    expect(cn("bg-warning-background", "bg-success-background")).toBe("bg-success-background");
  });

  test("keeps classes that don't conflict", () => {
    expect(cn("text-sm", "text-primary")).toBe("text-sm text-primary");
  });
});
