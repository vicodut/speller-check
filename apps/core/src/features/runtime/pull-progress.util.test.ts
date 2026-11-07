import { describe, expect, test } from "bun:test";
import {
  applyPullLine,
  INITIAL_PROGRESS,
  type PullLine,
  parsePullLine,
} from "./pull-progress.util";

const fold = (lines: PullLine[]) => lines.reduce(applyPullLine, INITIAL_PROGRESS);

describe("pull progress", () => {
  test("starts before any layer is known", () => {
    expect(fold([{ status: "pulling manifest" }])).toMatchObject({
      step: "starting",
      completed: 0,
      total: 0,
    });
  });

  test("sums bytes over layers, each counted once at its latest value", () => {
    const progress = fold([
      { status: "pulling manifest" },
      { status: "pulling a", digest: "sha256:a", total: 100 },
      { status: "pulling a", digest: "sha256:a", total: 100, completed: 40 },
      { status: "pulling b", digest: "sha256:b", total: 10, completed: 10 },
      { status: "pulling a", digest: "sha256:a", total: 100, completed: 90 },
    ]);
    expect(progress).toMatchObject({ step: "downloading", completed: 100, total: 110 });
  });

  test("verifies after the layers, and is done on success", () => {
    const layer = { status: "pulling a", digest: "sha256:a", total: 5, completed: 5 };
    expect(fold([layer, { status: "verifying sha256 digest" }]).step).toBe("verifying");
    expect(fold([layer, { status: "writing manifest" }, { status: "success" }])).toMatchObject({
      step: "done",
      completed: 5,
      total: 5,
    });
  });

  test("never lets completed run past total", () => {
    const progress = fold([{ status: "pulling a", digest: "sha256:a", total: 5, completed: 9 }]);
    expect(progress.completed).toBe(5);
  });
});

describe("parsePullLine", () => {
  test("reads a status or an error line, and nothing else", () => {
    expect(parsePullLine('{"status":"pulling a","digest":"sha256:a","total":3}')).toEqual({
      status: "pulling a",
      digest: "sha256:a",
      total: 3,
    });
    expect(parsePullLine('{"error":"pull model manifest: file does not exist"}')).toEqual({
      error: "pull model manifest: file does not exist",
    });
    expect(parsePullLine("not json")).toBeNull();
    expect(parsePullLine('{"total":"many"}')).toBeNull();
  });
});
