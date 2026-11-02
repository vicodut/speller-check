import { afterEach, describe, expect, test } from "bun:test";
import type { BackgroundMessage } from "../../shared/port-messages";
import { CorePort } from "./core-port";

const fakeRuntime = () => {
  const posted: unknown[] = [];
  const listeners: ((raw: unknown) => void)[] = [];
  let connects = 0;
  let disconnects = 0;
  const port = {
    postMessage: (message: unknown) => posted.push(message),
    disconnect: () => disconnects++,
    onMessage: { addListener: (l: (raw: unknown) => void) => listeners.push(l) },
    onDisconnect: { addListener: () => {} },
  };
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {
      connect: () => {
        connects++;
        return port;
      },
    },
  };
  return {
    posted,
    deliver: (raw: unknown) => {
      for (const l of listeners) l(raw);
    },
    connects: () => connects,
    disconnects: () => disconnects,
  };
};

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe("CorePort", () => {
  test("close disconnects, then drops sends and ignores late replies", () => {
    const runtime = fakeRuntime();
    const received: BackgroundMessage[] = [];
    const port = new CorePort((message) => received.push(message));
    port.send({ type: "field.closed", fieldId: "f1" });
    expect(runtime.posted).toHaveLength(1);

    port.close();
    expect(runtime.disconnects()).toBe(1);
    runtime.deliver({ type: "core.ready" });
    port.send({ type: "field.closed", fieldId: "f2" });
    expect(received).toEqual([]);
    expect(runtime.posted).toHaveLength(1);
    expect(runtime.connects()).toBe(1);
  });

  test("close before any send never connects", () => {
    const runtime = fakeRuntime();
    const port = new CorePort(() => {});
    port.close();
    port.send({ type: "field.closed", fieldId: "f1" });
    expect(runtime.connects()).toBe(0);
    expect(runtime.disconnects()).toBe(0);
  });
});
