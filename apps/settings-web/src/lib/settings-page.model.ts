import type { ProfileInput, ProfilesView, RuntimeView, SettingsView } from "@gc/protocol";
import type { ProbeEvent, ProbeState } from "./profile-probe.reducer";

/**
 * The key part of the form. `typed`: a new key, sent once on save and never shown back.
 * `saved`: the profile already has one. `remove`: delete the saved one.
 */
export type KeyField = {
  readonly typed: string;
  readonly remove: boolean;
  readonly saved: boolean;
};

/** The add/edit form: `id` null when adding. */
export type ProfileForm = {
  readonly id: string | null;
  readonly draft: ProfileInput;
  readonly key: KeyField;
  /** The endpoint's model list and the last Test result. */
  readonly probe: ProbeState;
};

/** What a save sends for the key: a string sets it, null removes it, undefined keeps it. */
export const keyChange = (key: KeyField): string | null | undefined => {
  const typed = key.typed.trim();
  if (typed) return typed;
  return key.remove ? null : undefined;
};

/** Events the settings page reducer accepts. Shared, because the profile and model sections send some of them. */
export type SettingsPageEvent =
  | {
      readonly type: "loaded";
      readonly view: SettingsView;
      readonly profiles: ProfilesView;
      readonly runtime: RuntimeView | null;
    }
  | { readonly type: "runtime"; readonly runtime: RuntimeView }
  /** A runtime action (pull, cancel) answered: shows its view and ends the busy state. */
  | { readonly type: "runtimeChanged"; readonly runtime: RuntimeView }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "reload" }
  | { readonly type: "add"; readonly input: ProfileInput }
  | { readonly type: "edit"; readonly id: string }
  | { readonly type: "draft"; readonly field: keyof ProfileInput; readonly value: string | null }
  | { readonly type: "key"; readonly typed: string }
  | { readonly type: "removeKey"; readonly remove: boolean }
  | { readonly type: "probe"; readonly event: ProbeEvent }
  | { readonly type: "cancel" }
  | { readonly type: "working" }
  | { readonly type: "actionFailed"; readonly error: string };
