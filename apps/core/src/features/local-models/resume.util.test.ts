import { describe, expect, test } from "bun:test";
import { classifyReply, planResume, rangeHeader } from "./resume.util";

describe("planResume", () => {
  test("starts from 0 with no partial file", () => {
    expect(planResume(0, 100)).toEqual({ kind: "fetch", offset: 0 });
  });

  test("resumes after the bytes already on disk", () => {
    expect(planResume(40, 100)).toEqual({ kind: "fetch", offset: 40 });
  });

  test("a complete partial file only needs verifying", () => {
    expect(planResume(100, 100)).toEqual({ kind: "complete" });
  });

  test("a partial file bigger than promised is discarded", () => {
    expect(planResume(101, 100)).toEqual({ kind: "fetch", offset: 0, discard: true });
  });
});

describe("rangeHeader", () => {
  test("asks for the rest only when resuming", () => {
    expect(rangeHeader(0)).toEqual({});
    expect(rangeHeader(40)).toEqual({ range: "bytes=40-" });
  });
});

describe("classifyReply", () => {
  test("a fresh download takes a 200 whole", () => {
    expect(classifyReply(200, null, 0, 100)).toBe("rewrite");
    expect(classifyReply(500, null, 0, 100)).toBe("fail");
  });

  test("a resume appends a 206 that starts at the offset of the same file", () => {
    expect(classifyReply(206, "bytes 40-99/100", 40, 100)).toBe("append");
  });

  test("a 206 for another range or another file size fails", () => {
    expect(classifyReply(206, "bytes 0-99/100", 40, 100)).toBe("fail");
    expect(classifyReply(206, "bytes 40-99/120", 40, 100)).toBe("fail");
    expect(classifyReply(206, null, 40, 100)).toBe("fail");
    expect(classifyReply(206, "bytes 40-99/*", 40, 100)).toBe("fail");
  });

  test("a server that ignores Range sends 200: start over", () => {
    expect(classifyReply(200, null, 40, 100)).toBe("rewrite");
  });

  test("416 means the partial file no longer fits: start over", () => {
    expect(classifyReply(416, null, 40, 100)).toBe("restart");
    expect(classifyReply(416, null, 0, 100)).toBe("fail");
  });
});
