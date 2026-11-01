export type FrameScheduler = {
  /** Asks for `run` on the next frame; calls made before it runs are merged. */
  schedule(): void;
  cancel(): void;
};

type RequestFrame = (cb: () => void) => number;
type CancelFrame = (id: number) => void;

/** Throttles `run` to at most once per animation frame. */
export const createFrameScheduler = (
  run: () => void,
  requestFrame: RequestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame: CancelFrame = (id) => cancelAnimationFrame(id),
): FrameScheduler => {
  let pending: number | null = null;
  return {
    schedule() {
      if (pending !== null) return;
      pending = requestFrame(() => {
        pending = null;
        run();
      });
    },
    cancel() {
      if (pending !== null) cancelFrame(pending);
      pending = null;
    },
  };
};
