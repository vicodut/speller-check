import { describe, expect, test } from "bun:test";
import {
  activateProfile,
  activeProfile,
  addProfile,
  firstRunFile,
  isLocalUrl,
  removeProfile,
  updateProfile,
} from "./profiles.util";
import { SettingsFile } from "./settings-file.schema";

const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

describe("firstRunFile", () => {
  test("holds one active Local profile on Ollama, and is a valid settings file", () => {
    const file = firstRunFile("p1");
    expect(activeProfile(file)).toEqual({
      id: "p1",
      name: "Local",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b",
      reasoningEffort: "none",
    });
    expect(SettingsFile.safeParse(file).success).toBe(true);
  });
});

describe("profile changes", () => {
  test("adding keeps the active profile", () => {
    const file = addProfile(firstRunFile("p1"), cloud, "p2");
    expect(file.profiles.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(file.activeProfileId).toBe("p1");
  });

  test("activating switches the active profile", () => {
    const file = addProfile(firstRunFile("p1"), cloud, "p2");
    const activated = activateProfile(file, "p2");
    expect(activated.ok && activeProfile(activated.value).name).toBe("Cloud");
  });

  test("updating replaces a profile's fields and keeps its id", () => {
    const updated = updateProfile(firstRunFile("p1"), "p1", { ...cloud, name: "Renamed" });
    expect(updated.ok && activeProfile(updated.value)).toEqual({
      id: "p1",
      ...cloud,
      name: "Renamed",
    });
  });

  test("removing an inactive profile works; the active one is refused", () => {
    const file = addProfile(firstRunFile("p1"), cloud, "p2");
    const removed = removeProfile(file, "p2");
    expect(removed.ok && removed.value.profiles.map((p) => p.id)).toEqual(["p1"]);
    expect(removeProfile(file, "p1")).toEqual({ ok: false, error: { code: "profile_active" } });
  });

  test("an unknown id is profile_not_found", () => {
    const file = firstRunFile("p1");
    const missing = { ok: false, error: { code: "profile_not_found" } } as const;
    expect(activateProfile(file, "nope")).toEqual(missing);
    expect(updateProfile(file, "nope", cloud)).toEqual(missing);
    expect(removeProfile(file, "nope")).toEqual(missing);
  });
});

describe("isLocalUrl", () => {
  test("is true only for endpoints on this Mac", () => {
    expect(isLocalUrl("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isLocalUrl("http://localhost:1234/v1")).toBe(true);
    expect(isLocalUrl("http://[::1]:8080/v1")).toBe(true);
    expect(isLocalUrl("https://openrouter.ai/api/v1")).toBe(false);
    expect(isLocalUrl("http://127.0.0.1.evil.example/v1")).toBe(false);
  });
});
