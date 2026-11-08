import { describe, expect, test } from "bun:test";
import {
  featureProfile,
  featureProfiles,
  profileUses,
  setFeatureProfiles,
} from "./feature-profiles.util";
import { addProfile, firstRunFile, removeProfile } from "./profiles.util";
import { SettingsFile } from "./settings-file.schema";

const cloud = {
  name: "Cloud",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "qwen/qwen3.8-flash",
  reasoningEffort: null,
};

/** Local (built-in, active) and Cloud. */
const twoProfiles = () => addProfile(firstRunFile("local"), cloud, "cloud");

describe("featureProfiles", () => {
  test("a file without a mapping uses the active profile for both features", () => {
    const file = twoProfiles();
    expect(featureProfiles(file)).toEqual({ check: null, rephrase: null });
    expect(featureProfile(file, "check").id).toBe("local");
    expect(featureProfile(file, "rephrase").id).toBe("local");
  });

  test("a mapped feature uses its profile; the other one follows the active profile", () => {
    const mapped = setFeatureProfiles(twoProfiles(), { check: null, rephrase: "cloud" });
    if (!mapped.ok) throw new Error("expected a mapping");
    expect(featureProfile(mapped.value, "check").id).toBe("local");
    expect(featureProfile(mapped.value, "rephrase").id).toBe("cloud");
    expect(SettingsFile.safeParse(mapped.value).success).toBe(true);
  });

  test("an unknown profile id is refused", () => {
    const mapped = setFeatureProfiles(twoProfiles(), { check: "ghost", rephrase: null });
    expect(mapped).toEqual({ ok: false, error: { code: "profile_not_found" } });
  });

  test("the settings file refuses a mapping to a profile it doesn't hold", () => {
    const file = { ...twoProfiles(), features: { check: "ghost", rephrase: null } };
    expect(SettingsFile.safeParse(file).success).toBe(false);
  });
});

describe("profileUses", () => {
  test("lists what uses a profile: active, and each feature mapped to it", () => {
    const mapped = setFeatureProfiles(twoProfiles(), { check: "cloud", rephrase: "cloud" });
    if (!mapped.ok) throw new Error("expected a mapping");
    expect(profileUses(mapped.value, "cloud")).toEqual(["check", "rephrase"]);
    expect(profileUses(mapped.value, "local")).toEqual(["active"]);
  });
});

describe("removing a profile a feature uses", () => {
  test("is refused with profile_in_use until the feature is moved off it", () => {
    const mapped = setFeatureProfiles(twoProfiles(), { check: null, rephrase: "cloud" });
    if (!mapped.ok) throw new Error("expected a mapping");
    expect(removeProfile(mapped.value, "cloud")).toEqual({
      ok: false,
      error: { code: "profile_in_use" },
    });
    const moved = setFeatureProfiles(mapped.value, { check: null, rephrase: "local" });
    if (!moved.ok) throw new Error("expected a mapping");
    expect(removeProfile(moved.value, "cloud").ok).toBe(true);
  });
});
