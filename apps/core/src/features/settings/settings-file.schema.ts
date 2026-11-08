import { FeatureProfiles, ProfileInput } from "@gc/protocol";
import { z } from "zod";

/** A saved profile: what you typed, plus an id. Never holds an API key (Keychain, #34). */
export const Profile = z.strictObject({ id: z.string().min(1), ...ProfileInput.shape });
export type Profile = z.infer<typeof Profile>;

/** The settings file (`settings.json` in the app's support folder). The active profile exists. */
export const SettingsFile = z
  .strictObject({
    version: z.literal(1),
    activeProfileId: z.string().min(1),
    /**
     * The first-run "Local" profile: it can be edited but never deleted. Optional only for files
     * saved before it existed; opening such a file marks its first local profile.
     */
    builtInProfileId: z.string().min(1).optional(),
    profiles: z.array(Profile).min(1),
    /** The profile each feature uses (null: same as active). Absent in files saved before #36. */
    features: FeatureProfiles.optional(),
  })
  .refine((file) => file.profiles.some((p) => p.id === file.activeProfileId), {
    message: "activeProfileId must name a saved profile",
  })
  .refine(
    ({ features, profiles }) =>
      [features?.check, features?.rephrase].every(
        (id) => id == null || profiles.some((p) => p.id === id),
      ),
    { message: "features must name saved profiles" },
  );
export type SettingsFile = z.infer<typeof SettingsFile>;
