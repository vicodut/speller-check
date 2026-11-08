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
});
