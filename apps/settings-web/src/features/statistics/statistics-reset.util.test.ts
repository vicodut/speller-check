import { describe, expect, test } from "bun:test";
import { IDLE_RESET, type ResetState, resetStep } from "./statistics-reset.util";

const confirming: ResetState = { phase: "confirming", error: null };
const clearing: ResetState = { phase: "clearing", error: null };

describe("resetStep", () => {
  test("Reset statistics opens the confirmation and forgets an old error, with no request", () => {
    const failed: ResetState = { phase: "idle", error: "statistics_write_failed" };
    expect(resetStep(failed, { type: "reset" })).toEqual({ state: confirming, request: false });
  });

  test("cancel closes the confirmation and makes no request; an old error stays", () => {
    const step = resetStep(
      { phase: "confirming", error: "statistics_write_failed" },
      { type: "cancel" },
    );
    expect(step).toEqual({
      state: { phase: "idle", error: "statistics_write_failed" },
      request: false,
    });
  });

  test("confirm makes the clear request and waits for it, with no error shown", () => {
    expect(resetStep(confirming, { type: "confirm" })).toEqual({
      state: clearing,
      request: true,
    });
  });

  test("a cleared answer closes the confirmation; a failure is kept to show", () => {
    expect(resetStep(clearing, { type: "cleared", error: null })).toEqual({
      state: IDLE_RESET,
      request: false,
    });
    expect(
      resetStep(clearing, { type: "cleared", error: "statistics_write_failed" }).state,
    ).toEqual({ phase: "idle", error: "statistics_write_failed" });
  });

  test("events that do not apply to the phase change nothing and make no request", () => {
    expect(resetStep(IDLE_RESET, { type: "cancel" })).toEqual({
      state: IDLE_RESET,
      request: false,
    });
    expect(resetStep(IDLE_RESET, { type: "confirm" })).toEqual({
      state: IDLE_RESET,
      request: false,
    });
    expect(resetStep(confirming, { type: "reset" })).toEqual({
      state: confirming,
      request: false,
    });
    expect(resetStep(clearing, { type: "cancel" })).toEqual({ state: clearing, request: false });
    expect(resetStep(clearing, { type: "confirm" })).toEqual({ state: clearing, request: false });
    expect(resetStep(IDLE_RESET, { type: "cleared", error: null })).toEqual({
      state: IDLE_RESET,
      request: false,
    });
  });
});
