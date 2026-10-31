import { describe, expect, test } from "bun:test";
import { FieldRegistry } from "./field-registry.store";

describe("FieldRegistry", () => {
  test("gives each element a stable id and an increasing version", () => {
    const registry = new FieldRegistry<object>();
    const a = {};
    const b = {};
    expect(registry.bump(a)).toEqual({ fieldId: "f1", version: 1 });
    expect(registry.bump(a)).toEqual({ fieldId: "f1", version: 2 });
    expect(registry.bump(b)).toEqual({ fieldId: "f2", version: 1 });
  });

  test("keeps versions increasing across close and reopen", () => {
    const registry = new FieldRegistry<object>();
    const a = {};
    registry.bump(a);
    expect(registry.close(a)).toBe("f1");
    expect(registry.bump(a)).toEqual({ fieldId: "f1", version: 2 });
  });

  test("returns the field only for its current version", () => {
    const registry = new FieldRegistry<object>();
    const a = {};
    registry.bump(a);
    registry.bump(a);
    expect(registry.current("f1", 2)).toBe(a);
    expect(registry.current("f1", 1)).toBeUndefined();
    expect(registry.current("f9", 1)).toBeUndefined();
  });

  test("forgets closed fields", () => {
    const registry = new FieldRegistry<object>();
    const a = {};
    registry.bump(a);
    registry.close(a);
    expect(registry.current("f1", 1)).toBeUndefined();
    expect(registry.openField("f1")).toBeUndefined();
    expect(registry.close(a)).toBeUndefined();
    expect(registry.close({})).toBeUndefined();
  });
});
