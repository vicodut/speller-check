import { describe, expect, test } from "bun:test";
import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import { type Provider, SwitchableProvider } from "../providers";
import { CheckService } from "./check.service";
import { CheckCache } from "./services/check-cache.service";

/** A model that finds nothing; its replies wait for `release` so a swap can happen mid-check. */
const gated = (model: string) => {
  const waiting: Array<() => void> = [];
  let calls = 0;
  const provider: Provider = {
    model,
    healthcheck: async () => true,
    complete: () => {
      calls += 1;
      return new Promise((resolve) => waiting.push(() => resolve(ok('{"issues":[]}'))));
    },
  };
  return { provider, release: () => waiting.shift()?.(), calls: () => calls };
};

const text = "I went to the store.";

describe("CheckService with a provider swapped mid-check", () => {
  test("the check finishes on the old model and its result is cached under that model only", async () => {
    const a = gated("a");
    const b = gated("b");
    const switchable = new SwitchableProvider(a.provider);
    const dictionary = { load: async () => ok([]) };
    const service = new CheckService(
      switchable,
      new CheckCache(),
      dictionary,
      new Logger(() => {}),
    );

    const running = service.check({ text });
    await Promise.resolve();
    switchable.swap(b.provider);
    a.release();
    expect((await running).ok).toBe(true);

    // On the new model the sentence isn't cached: its result came from the old one.
    const onB = service.check({ text });
    await Bun.sleep(0);
    expect(b.calls()).toBe(1);
    b.release();
    await onB;

    // Back on the old model, the sentence is answered from the cache.
    switchable.swap(a.provider);
    await service.check({ text });
    expect(a.calls()).toBe(1);
  });
});
