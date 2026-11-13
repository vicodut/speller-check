import { describe, expect, test } from "bun:test";
import { createCore } from "./main";
import { Logger } from "./shared/logger";

// Port 9 refuses at once: the background warm-ups fail fast and quietly.
const at = (model: string) => ({ baseUrl: "http://127.0.0.1:9/v1", model });

describe("createCore", () => {
  test("each feature starts on its own model", () => {
    const core = createCore(
      { dictionaryPath: "/nonexistent/dictionary.json" },
      { check: at("check-model"), rephrase: at("rephrase-model") },
      new Logger(() => {}),
    );
    expect(core.providers.check.model).toBe("check-model");
    expect(core.providers.rephrase.model).toBe("rephrase-model");
  });

  test("switching one feature's model leaves the other one alone", () => {
    const core = createCore(
      { dictionaryPath: "/nonexistent/dictionary.json" },
      { check: at("same"), rephrase: at("same") },
      new Logger(() => {}),
    );
    core.switchModel("rephrase", at("cloud-rephrase"));
    expect(core.providers.check.model).toBe("same");
    expect(core.providers.rephrase.model).toBe("cloud-rephrase");
    core.switchModel("check", at("local-check"));
    expect(core.providers.check.model).toBe("local-check");
    expect(core.providers.rephrase.model).toBe("cloud-rephrase");
  });

  test("a warm-up call reaches the model but records no statistics", async () => {
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => {
        requests += 1;
        return Response.json({ choices: [{ message: { content: "ok" } }] });
      },
    });
    try {
      const recorded: unknown[] = [];
      const model = { baseUrl: `http://127.0.0.1:${server.port}/v1`, model: "warm" };
      const core = createCore(
        { dictionaryPath: "/nonexistent/dictionary.json" },
        { check: model, rephrase: model },
        new Logger(() => {}),
        { record: (samples) => recorded.push(...samples) },
      );
      await core.warmUp();
      expect(requests).toBe(1);
      expect(recorded).toEqual([]);
    } finally {
      server.stop(true);
    }
  });
});
