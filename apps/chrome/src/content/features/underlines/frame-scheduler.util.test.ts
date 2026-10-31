import { describe, expect, test } from "bun:test";
import { createFrameScheduler } from "./frame-scheduler.util";

const fakeFrames = () => {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    request: (cb: () => void) => {
      queue.set(next, cb);
      return next++;
    },
    cancel: (id: number) => queue.delete(id),
    flush: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const cb of callbacks) cb();
    },
    size: () => queue.size,
  };
};

describe("createFrameScheduler", () => {
  test("merges calls made within one frame", () => {
    const frames = fakeFrames();
    let runs = 0;
    const scheduler = createFrameScheduler(() => runs++, frames.request, frames.cancel);
    scheduler.schedule();
    scheduler.schedule();
    expect(frames.size()).toBe(1);
    frames.flush();
    expect(runs).toBe(1);
    scheduler.schedule();
    frames.flush();
    expect(runs).toBe(2);
  });

  test("cancel drops the pending run", () => {
    const frames = fakeFrames();
    let runs = 0;
    const scheduler = createFrameScheduler(() => runs++, frames.request, frames.cancel);
    scheduler.schedule();
    scheduler.cancel();
    frames.flush();
    expect(runs).toBe(0);
  });
});
