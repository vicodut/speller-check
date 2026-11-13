/** Where the Reset flow stands: idle, asking for confirmation, or waiting for the clear to finish. */
export type ResetState = {
  readonly phase: "idle" | "confirming" | "clearing";
  /** The code of the last clear that failed, shown until the next Reset. */
  readonly error: string | null;
};

export type ResetEvent =
  | { readonly type: "reset" }
  | { readonly type: "cancel" }
  | { readonly type: "confirm" }
  | { readonly type: "cleared"; readonly error: string | null };

export type ResetStep = {
  readonly state: ResetState;
  /** True when this step sends the clear request. Only Clear all does; Cancel never does. */
  readonly request: boolean;
};

export const IDLE_RESET: ResetState = { phase: "idle", error: null };

const stay = (state: ResetState): ResetStep => ({ state, request: false });

/** The Reset flow as a pure step: an event that does not apply to the phase changes nothing. */
export const resetStep = (state: ResetState, event: ResetEvent): ResetStep => {
  switch (event.type) {
    case "reset":
      return state.phase === "idle" ? stay({ phase: "confirming", error: null }) : stay(state);
    case "cancel":
      return state.phase === "confirming"
        ? stay({ phase: "idle", error: state.error })
        : stay(state);
    case "confirm":
      return state.phase === "confirming"
        ? { state: { phase: "clearing", error: null }, request: true }
        : stay(state);
    case "cleared":
      return state.phase === "clearing" ? stay({ phase: "idle", error: event.error }) : stay(state);
  }
};
