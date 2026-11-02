import { describe, expect, test } from "bun:test";
import { defaultSettings, type ExtensionSettings } from "../../../shared/extension-settings.schema";
import { SiteGate } from "./site-gate.controller";

const settings = (blockedSites: string[]): ExtensionSettings => ({
  ...defaultSettings(),
  blockedSites,
});

const setup = (initial: ExtensionSettings) => {
  const log: string[] = [];
  let listener: ((s: ExtensionSettings) => void) | undefined;
  let resolveLoad: (s: ExtensionSettings) => void = () => {};
  const loaded = new Promise<ExtensionSettings>((resolve) => {
    resolveLoad = resolve;
  });
  const gate = new SiteGate({
    isBlocked: (s) => s.blockedSites.includes("bank.com"),
    start: () => {
      log.push("start");
      return () => log.push("stop");
    },
    load: () => loaded,
    subscribe: (l) => {
      listener = l;
    },
  });
  const ready = gate.init();
  return {
    gate,
    log,
    change: (s: ExtensionSettings) => listener?.(s),
    load: async () => {
      resolveLoad(initial);
      await ready;
    },
  };
};

describe("SiteGate", () => {
  test("starts on load when the site is not blocked", async () => {
    const { gate, log, load } = setup(settings([]));
    expect(log).toEqual([]);
    await load();
    expect(log).toEqual(["start"]);
    expect(gate.running).toBe(true);
  });

  test("does not start on load when the site is blocked", async () => {
    const { gate, log, load } = setup(settings(["bank.com"]));
    await load();
    expect(log).toEqual([]);
    expect(gate.running).toBe(false);
  });

  test("stops when the site becomes blocked and restarts when unblocked", async () => {
    const { gate, log, load, change } = setup(settings([]));
    await load();
    change(settings(["bank.com"]));
    expect(log).toEqual(["start", "stop"]);
    expect(gate.running).toBe(false);
    change(settings([]));
    expect(log).toEqual(["start", "stop", "start"]);
    expect(gate.running).toBe(true);
  });

  test("ignores changes that keep the same blocked state", async () => {
    const { log, load, change } = setup(settings([]));
    await load();
    change(settings(["other.com"]));
    change({ ...settings([]), token: "new" });
    expect(log).toEqual(["start"]);
    change(settings(["bank.com"]));
    change(settings(["bank.com", "other.com"]));
    expect(log).toEqual(["start", "stop"]);
  });

  test("a change before the initial load resolves wins over the loaded value", async () => {
    const { log, load, change } = setup(settings([]));
    change(settings(["bank.com"]));
    await load();
    expect(log).toEqual([]);
  });
});
