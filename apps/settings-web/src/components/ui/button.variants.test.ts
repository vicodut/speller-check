import { describe, expect, test } from "bun:test";
import { buttonVariants } from "./button.variants";

const classes = (value: string) => value.split(/\s+/);

describe("buttonVariants", () => {
  test("defaults to the primary look at the default size", () => {
    const base = classes(buttonVariants());
    expect(base).toContain("bg-primary");
    expect(base).toContain("h-9");
    expect(base).toContain("rounded-md");
  });

  test("every variant shows a focus ring from the accent token", () => {
    for (const variant of [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ] as const) {
      expect(classes(buttonVariants({ variant }))).toContain("focus-visible:ring-ring/50");
    }
  });

  test("every variant looks disabled when disabled", () => {
    expect(classes(buttonVariants({ variant: "outline" }))).toContain("disabled:opacity-50");
  });

  test("variants pick their own colours", () => {
    expect(classes(buttonVariants({ variant: "destructive" }))).toContain("bg-destructive");
    expect(classes(buttonVariants({ variant: "outline" }))).toContain("border");
    expect(classes(buttonVariants({ variant: "link" }))).toContain("text-primary");
    expect(classes(buttonVariants({ variant: "outline" }))).not.toContain("bg-primary");
  });

  test("sizes change the height", () => {
    expect(classes(buttonVariants({ size: "sm" }))).toContain("h-8");
    expect(classes(buttonVariants({ size: "lg" }))).toContain("h-10");
    expect(classes(buttonVariants({ size: "icon" }))).toContain("size-9");
  });

  test("an extra class overrides a conflicting variant class", () => {
    const merged = classes(buttonVariants({ size: "sm", className: "h-12" }));
    expect(merged).toContain("h-12");
    expect(merged).not.toContain("h-8");
  });
});
