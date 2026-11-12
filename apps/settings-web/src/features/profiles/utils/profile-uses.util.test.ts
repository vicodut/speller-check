import { describe, expect, test } from "bun:test";
import type { ProfilesView, ProfileView } from "@gc/protocol";
import { confirmText, moveToLocal, profileUses } from "./profile-uses.util";

const profile = (id: string, builtIn = false): ProfileView => ({
  id,
  name: id === "local" ? "Local" : "Cloud",
  baseUrl: builtIn ? "http://127.0.0.1:11434/v1" : "https://openrouter.ai/api/v1",
  model: "m",
  reasoningEffort: null,
  local: builtIn,
  builtIn,
  hasKey: false,
});

const view = (
  activeProfileId: string,
  features: ProfilesView["features"] = { check: null, rephrase: null },
): ProfilesView => ({
  profiles: [profile("local", true), profile("cloud"), profile("other")],
  features,
  activeProfileId,
  lockedByEnv: false,
});

describe("profileUses", () => {
  test("lists the active use first, then each feature mapped to the profile", () => {
    expect(profileUses(view("cloud", { check: null, rephrase: "cloud" }), "cloud")).toEqual([
      "active",
      "rephrase",
    ]);
    expect(profileUses(view("local"), "other")).toEqual([]);
  });
});

describe("confirmText", () => {
  test("says what moves to Local, in plain words", () => {
    expect(confirmText("Cloud", ["active"])).toBe(
      "Cloud is the active profile. Make Local active and delete Cloud?",
    );
    expect(confirmText("Cloud", ["check", "rephrase"])).toBe(
      "Cloud is used by Check and Rephrase. Move Check and Rephrase to Local and delete Cloud?",
    );
    expect(confirmText("Cloud", ["active", "rephrase"])).toBe(
      "Cloud is the active profile and used by Rephrase. Make Local active, move Rephrase to Local and delete Cloud?",
    );
  });
});

describe("moveToLocal", () => {
  test("activates Local when the profile is active, and remaps only its features", () => {
    const plan = moveToLocal(view("cloud", { check: "other", rephrase: "cloud" }), "cloud");
    expect(plan).toEqual({
      activate: "local",
      features: { check: "other", rephrase: "local" },
    });
  });

  test("changes nothing it doesn't need to", () => {
    expect(moveToLocal(view("local", { check: "cloud", rephrase: null }), "cloud")).toEqual({
      activate: null,
      features: { check: "local", rephrase: null },
    });
    expect(moveToLocal(view("cloud"), "cloud")).toEqual({ activate: "local", features: null });
  });

  test("gives up when there's no built-in profile to move to", () => {
    const noLocal = { ...view("cloud"), profiles: [profile("cloud")] };
    expect(moveToLocal(noLocal, "cloud")).toBeNull();
  });
});
