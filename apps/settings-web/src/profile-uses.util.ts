import type { Feature, FeatureProfiles, ProfilesView } from "@gc/protocol";

/** What can use a profile: being the active one, or a feature mapped to it. */
export type ProfileUse = "active" | Feature;

const FEATURES: readonly Feature[] = ["check", "rephrase"];
/** Everything that uses a profile; the core refuses to delete it while this isn't empty. */
export const profileUses = (view: ProfilesView, id: string): ProfileUse[] => {
  const mapped = FEATURES.filter((f) => view.features[f] === id);
  return view.activeProfileId === id ? ["active", ...mapped] : mapped;
};

const FEATURE_NAME: Record<Feature, string> = { check: "Check", rephrase: "Rephrase" };

/** "Check and Rephrase". */
const featureList = (features: readonly Feature[]): string => {
  const words = features.map((f) => FEATURE_NAME[f]);
  const last = words.pop() ?? "";
  return words.length > 0 ? `${words.join(", ")} and ${last}` : last;
};

/** The question asked before deleting a profile in use, saying what moves to Local. */
export const confirmText = (name: string, uses: readonly ProfileUse[]): string => {
  const active = uses.includes("active");
  const features = featureList(uses.filter((u): u is Feature => u !== "active"));
  if (active && features)
    return `${name} is the active profile and used by ${features}. Make Local active, move ${features} to Local and delete ${name}?`;
  if (active) return `${name} is the active profile. Make Local active and delete ${name}?`;
  return `${name} is used by ${features}. Move ${features} to Local and delete ${name}?`;
};

/**
 * What to change so nothing uses a profile any more, moving each use to the built-in Local
 * profile (which can't be deleted). `activate`/`features`: null when that part needn't change.
 * Null when there's no built-in profile.
 */
export const moveToLocal = (
  view: ProfilesView,
  id: string,
): { activate: string | null; features: FeatureProfiles | null } | null => {
  const local = view.profiles.find((p) => p.builtIn);
  if (!local) return null;
  const mapped = FEATURES.some((f) => view.features[f] === id);
  const remap = (f: Feature) => (view.features[f] === id ? local.id : view.features[f]);
  return {
    activate: view.activeProfileId === id ? local.id : null,
    features: mapped ? { check: remap("check"), rephrase: remap("rephrase") } : null,
  };
};
