import { describe, expect, test } from "bun:test";
import { toFeatureModel } from "./feature-model.util";

const config = (baseUrl: string) => ({ baseUrl, model: "m" });

describe("toFeatureModel", () => {
  test("a local endpoint stays local and names its host", () => {
    expect(toFeatureModel(config("http://127.0.0.1:11434/v1"))).toEqual({
      model: "m",
      local: true,
      provider: "127.0.0.1",
    });
  });

  test("a cloud endpoint names its host", () => {
    expect(toFeatureModel(config("https://openrouter.ai/api/v1"))).toEqual({
      model: "m",
      local: false,
      provider: "openrouter.ai",
    });
  });

  test("an unparsable URL has no provider", () => {
    expect(toFeatureModel(config("nope"))).toEqual({ model: "m", local: false });
  });
});
