import { describe, expect, test } from "bun:test";
import { FieldOwnershipRouter, fromGlobalFieldId, toGlobalFieldId } from "./field-ownership.router";

describe("global field ids", () => {
  test("round-trip, even when the local id contains the separator", () => {
    expect(fromGlobalFieldId(toGlobalFieldId("p1", "f/2"))).toEqual({
      portId: "p1",
      fieldId: "f/2",
    });
  });

  test("reject ids without a port or a field part", () => {
    expect(fromGlobalFieldId("f1")).toBeUndefined();
    expect(fromGlobalFieldId("/f1")).toBeUndefined();
    expect(fromGlobalFieldId("p1/")).toBeUndefined();
  });
});

describe("FieldOwnershipRouter", () => {
  test("resolves open fields to their port", () => {
    const router = new FieldOwnershipRouter();
    const globalId = router.open("p1", "f1");
    expect(globalId).toBe("p1/f1");
    expect(router.resolve(globalId)).toEqual({ portId: "p1", fieldId: "f1" });
  });

  test("keeps ports apart when frame-local ids collide", () => {
    const router = new FieldOwnershipRouter();
    const a = router.open("p1", "f1");
    const b = router.open("p2", "f1");
    expect(a).not.toBe(b);
    expect(router.resolve(b)).toEqual({ portId: "p2", fieldId: "f1" });
  });

  test("stops resolving closed fields", () => {
    const router = new FieldOwnershipRouter();
    router.open("p1", "f1");
    expect(router.close("p1", "f1")).toBe("p1/f1");
    expect(router.resolve("p1/f1")).toBeUndefined();
  });

  test("returns a port's open fields when it disconnects", () => {
    const router = new FieldOwnershipRouter();
    router.open("p1", "f1");
    router.open("p1", "f2");
    router.open("p2", "f1");
    expect(router.closePort("p1").sort()).toEqual(["p1/f1", "p1/f2"]);
    expect(router.closePort("p1")).toEqual([]);
    expect(router.resolve("p2/f1")).toBeDefined();
  });

  test("ignores ids for unknown ports or fields", () => {
    const router = new FieldOwnershipRouter();
    expect(router.resolve("p9/f1")).toBeUndefined();
    expect(router.resolve("garbage")).toBeUndefined();
  });
});
