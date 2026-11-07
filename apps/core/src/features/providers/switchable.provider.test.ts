import { describe, expect, test } from "bun:test";
import { ok } from "../../shared/result";
import type { Provider } from "./provider";
import { pinProvider, SwitchableProvider } from "./switchable.provider";

/** A provider whose replies wait until `release` is called, so a swap can happen mid-call. */
const gated = (model: string) => {
  const waiting: Array<() => void> = [];
  let warmed = 0;
  const provider: Provider = {
    model,
    complete: () =>
      new Promise((resolve) => {
        waiting.push(() => resolve(ok(model)));
      }),
    listModels: async () => ok([model]),
    healthcheck: async () => model !== "down",
    warmUp: async () => {
      warmed += 1;
    },
  };
  return { provider, release: () => waiting.shift()?.(), warmed: () => warmed };
};

const messages = [{ role: "user", content: "x" }] as const;

describe("SwitchableProvider", () => {
  test("serves calls with the current provider and reports its model", async () => {
    const a = gated("a");
    const switchable = new SwitchableProvider(a.provider);
    const reply = switchable.complete(messages);
    a.release();
    expect(await reply).toEqual(ok("a"));
    expect(switchable.model).toBe("a");
  });

  test("a call started before a swap finishes on the old provider; later calls use the new one", async () => {
    const a = gated("a");
    const b = gated("b");
    const switchable = new SwitchableProvider(a.provider);
    const before = switchable.complete(messages);
    switchable.swap(b.provider);
    const after = switchable.complete(messages);
    a.release();
    b.release();
    expect(await before).toEqual(ok("a"));
    expect(await after).toEqual(ok("b"));
    expect(switchable.model).toBe("b");
  });

  test("passes listModels, healthcheck and warmUp to the current provider", async () => {
    const a = gated("a");
    const down = gated("down");
    const switchable = new SwitchableProvider(a.provider);
    expect(await switchable.listModels()).toEqual(ok(["a"]));
    await switchable.warmUp();
    expect(a.warmed()).toBe(1);
    switchable.swap(down.provider);
    expect(await switchable.healthcheck()).toBe(false);
  });
});

describe("pinProvider", () => {
  test("a pinned unit of work keeps its provider and model across a swap", async () => {
    const a = gated("a");
    const switchable = new SwitchableProvider(a.provider);
    const pinned = pinProvider(switchable);
    switchable.swap(gated("b").provider);
    const reply = pinned.complete(messages);
    a.release();
    expect(await reply).toEqual(ok("a"));
    expect(pinned.model).toBe("a");
  });

  test("a provider that can't be swapped pins to itself", () => {
    const { provider } = gated("a");
    expect(pinProvider(provider)).toBe(provider);
  });
});
