import type {
  Feature,
  FeatureProfiles,
  ProfileSave,
  ProfilesView,
  SettingsView,
} from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import {
  FEATURES,
  featureProfile,
  featureProfiles,
  setFeatureProfiles,
} from "./feature-profiles.util";
import type { KeyStore } from "./keychain.repository";
import { toConfig } from "./profile-config.util";
import { ProfileKeys } from "./profile-keys.service";
import {
  activateProfile,
  addProfile,
  firstRunFile,
  isLocalUrl,
  markBuiltIn,
  removeProfile,
  sameOrigin,
  updateProfile,
} from "./profiles.util";
import type { Env } from "./settings.loader";
import type { ModelConfig } from "./settings.schema";
import type { SettingsFileRepository } from "./settings-file.repository";
import type { SettingsFile } from "./settings-file.schema";
import { buildSettingsView, profileFeatureView } from "./settings-view.builder";

type Store = Pick<SettingsFileRepository, "load" | "save">;
/** The model each feature runs with. */
export type FeatureModels = Readonly<Record<Feature, ModelConfig>>;
/** `changed`: the features whose model changed; only their providers are swapped. */
export type ModelListener = (models: FeatureModels, changed: readonly Feature[]) => void;
/** Told when a profile is deleted, with the last name it had. */
export type RemovedListener = (profile: { id: string; name: string }) => void;

/**
 * The model settings the core runs with: the saved profiles (keys in the Keychain), or a locked
 * "Environment" model when `GC_*` env vars give one. Check and Rephrase each use the active profile
 * unless mapped to their own. Every change is saved first; a change to a model in use then tells
 * the listeners which features changed (they swap those providers and notify clients).
 */
export class SettingsService {
  private readonly listeners: ModelListener[] = [];
  private readonly removedListeners: RemovedListener[] = [];

  private constructor(
    private file: SettingsFile,
    private readonly store: Store,
    private readonly keys: ProfileKeys,
    private readonly env: Env,
    private readonly envModel: ModelConfig | null,
    private readonly newId: () => string,
  ) {}

  /** Loads the saved profiles, creating and saving the first-run "Local" one if there are none. */
  static async open(
    store: Store,
    keys: KeyStore,
    env: Env,
    envModel: ModelConfig | null,
    newId: () => string = () => crypto.randomUUID(),
  ): Promise<Result<SettingsService, AppError>> {
    const loaded = await store.load();
    if (!loaded.ok) return loaded;
    const file = loaded.value ? markBuiltIn(loaded.value) : firstRunFile(newId());
    if (file !== loaded.value) {
      const saved = await store.save(file);
      if (!saved.ok) return saved;
    }
    const profileKeys = await ProfileKeys.load(keys, file);
    return ok(new SettingsService(file, store, profileKeys, env, envModel, newId));
  }

  /** The models in use now: the env one for both if given, else each feature's profile, keyed. */
  async current(): Promise<FeatureModels> {
    const [check, rephrase] = await Promise.all(FEATURES.map((f) => this.modelFor(f)));
    return { check: check as ModelConfig, rephrase: rephrase as ModelConfig };
  }

  view(): SettingsView {
    if (this.envModel) return buildSettingsView(this.env, this.envModel);
    const view = (f: Feature) => {
      const profile = featureProfile(this.file, f);
      return profileFeatureView(profile, this.keys.has(profile.id));
    };
    return { check: view("check"), rephrase: view("rephrase") };
  }

  profiles(): ProfilesView {
    return {
      profiles: this.file.profiles.map((p) => ({
        ...p,
        local: isLocalUrl(p.baseUrl),
        builtIn: p.id === this.file.builtInProfileId,
        hasKey: this.keys.has(p.id),
      })),
      features: featureProfiles(this.file),
      activeProfileId: this.envModel ? null : this.file.activeProfileId,
      lockedByEnv: this.envModel !== null,
    };
  }

  /**
   * The key saved for a profile, for a test or model list from the page. Only while `baseUrl`
   * stays on the saved profile's host, so editing the URL never sends the key elsewhere.
   */
  async savedKeyFor(profileId: string | null, baseUrl: string): Promise<string | null> {
    const profile = this.file.profiles.find((p) => p.id === profileId);
    if (!profile || !sameOrigin(profile.baseUrl, baseUrl)) return null;
    return this.keys.read(profile.id);
  }

  onChange(listener: ModelListener): void {
    this.listeners.push(listener);
  }

  onRemoved(listener: RemovedListener): void {
    this.removedListeners.push(listener);
  }

  /** The key is stored first: a profile is never saved claiming a key the Keychain refused. */
  async create({ apiKey, ...input }: ProfileSave): Promise<Result<ProfilesView, AppError>> {
    const id = this.newId();
    const key = await this.keys.apply(id, apiKey);
    if (!key.ok) return key;
    const result = await this.commit(ok(addProfile(this.file, input, id)), null);
    if (!result.ok && apiKey) await this.keys.apply(id, null);
    return result;
  }

  async update(
    id: string,
    { apiKey, ...input }: ProfileSave,
  ): Promise<Result<ProfilesView, AppError>> {
    const next = updateProfile(this.file, id, input);
    if (!next.ok) return next;
    const key = await this.keys.apply(id, apiKey);
    if (!key.ok) return key;
    return this.commit(next, apiKey === undefined ? null : id);
  }

  /** Deleting a profile deletes its Keychain item too, and tells the removal listeners its name. */
  async remove(id: string): Promise<Result<ProfilesView, AppError>> {
    const profile = this.file.profiles.find((p) => p.id === id);
    const result = await this.commit(removeProfile(this.file, id), null);
    if (!result.ok) return result;
    if (profile) for (const listener of this.removedListeners) listener({ id, name: profile.name });
    if (this.keys.has(id)) await this.keys.apply(id, null);
    return ok(this.profiles());
  }

  /** Refused while env vars give the model: the page must not claim a profile is in use. */
  activate(id: string): Promise<Result<ProfilesView, AppError>> {
    if (this.envModel) return Promise.resolve(err(appError("settings_locked")));
    return this.commit(activateProfile(this.file, id), null);
  }

  /** Maps Check and Rephrase to profiles (null: same as active); locked like `activate`. */
  setFeatures(features: FeatureProfiles): Promise<Result<ProfilesView, AppError>> {
    if (this.envModel) return Promise.resolve(err(appError("settings_locked")));
    return this.commit(setFeatureProfiles(this.file, features), null);
  }

  /** `keyChanged`: the profile whose key just changed; a feature using it changes model too. */
  private async commit(
    next: Result<SettingsFile, AppError>,
    keyChanged: string | null,
  ): Promise<Result<ProfilesView, AppError>> {
    if (!next.ok) return next;
    const before = FEATURES.map((f) => JSON.stringify(this.inUse(f)));
    const saved = await this.store.save(next.value);
    if (!saved.ok) return saved;
    this.file = next.value;
    const changed = FEATURES.filter(
      (f, i) =>
        JSON.stringify(this.inUse(f)) !== before[i] ||
        (!this.envModel && featureProfile(this.file, f).id === keyChanged),
    );
    if (changed.length > 0) {
      const models = await this.current();
      for (const listener of this.listeners) listener(models, changed);
    }
    return ok(this.profiles());
  }

  private async modelFor(feature: Feature): Promise<ModelConfig> {
    if (this.envModel) return this.envModel;
    const profile = featureProfile(this.file, feature);
    const apiKey = await this.keys.read(profile.id);
    return { ...toConfig(profile), ...(apiKey ? { apiKey } : {}) };
  }

  /** A feature's model without its key, to tell whether a change touched it. */
  private inUse(feature: Feature): ModelConfig {
    return this.envModel ?? toConfig(featureProfile(this.file, feature));
  }
}
