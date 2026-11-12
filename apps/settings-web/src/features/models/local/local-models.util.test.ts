import { describe, expect, test } from "bun:test";
import type { LocalModelView } from "@gc/protocol";
import { anyDownloading, downloadLabel, ramWarningText, scoreText } from "./local-models.util";

const model = (patch: Partial<LocalModelView> = {}): LocalModelView => ({
  id: "a",
  kind: "model",
  name: "A",
  sizeBytes: 5_000_000_000,
  ramBytes: 8 * 1024 ** 3,
  fixtureScore: { passed: 19, total: 20 },
  state: "absent",
  completed: 0,
  error: null,
  ramWarning: false,
  inUse: false,
  ...patch,
});

describe("local model texts", () => {
  test("progress label shows bytes and percent, then verifying", () => {
    expect(downloadLabel(model({ state: "downloading", completed: 2_500_000_000 }))).toBe(
      "2.5 GB of 5 GB · 50%",
    );
    expect(downloadLabel(model({ state: "verifying", completed: 5_000_000_000 }))).toBe(
      "Verifying…",
    );
  });

  test("the RAM warning only appears when the model flags it", () => {
    expect(ramWarningText(model(), 16 * 1024 ** 3)).toBeNull();
    expect(ramWarningText(model({ ramWarning: true }), 4 * 1024 ** 3)).toBe(
      "Needs about 8 GB of memory; this Mac has 4 GB. It may be slow or fail to load.",
    );
  });

  test("the score reads as a fraction or as not benchmarked", () => {
    expect(scoreText(model())).toBe("19/20 on the fixtures");
    expect(scoreText(model({ fixtureScore: null }))).toBe("not benchmarked yet");
  });

  test("polling is needed while any model downloads or verifies", () => {
    expect(anyDownloading(null)).toBe(false);
    const view = (state: LocalModelView["state"]) => ({
      memoryBytes: 1,
      models: [model({ state })],
    });
    expect(anyDownloading(view("ready"))).toBe(false);
    expect(anyDownloading(view("downloading"))).toBe(true);
    expect(anyDownloading(view("verifying"))).toBe(true);
  });
});
