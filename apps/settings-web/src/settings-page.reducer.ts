import type { ProfileInput, ProfilesView, RuntimeView, SettingsView } from "@gc/protocol";

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
};

/** What a save sends for the key: a string sets it, null removes it, undefined keeps it. */
export const keyChange = (key: KeyField): string | null | undefined => {
  const typed = key.typed.trim();
  if (typed) return typed;
  return key.remove ? null : undefined;
};

const NO_KEY: KeyField = { typed: "", remove: false, saved: false };

type Ready = {
  readonly phase: "ready";
  readonly view: SettingsView;
  readonly profiles: ProfilesView;
  /** Null when the core couldn't report it; the page works without it. */
  readonly runtime: RuntimeView | null;
  readonly form: ProfileForm | null;
  /** A profile action is in flight: buttons are disabled. */
  readonly busy: boolean;
  /** The last action's error code, shown until the next action. */
  readonly notice: string | null;
};

/** Everything the settings page shows. One reducer holds it all; API calls happen around it. */
export type SettingsPageState =
  | { readonly phase: "loading" }
  | Ready
  | { readonly phase: "error"; readonly error: string };

export type SettingsPageEvent =
  | {
      readonly type: "loaded";
      readonly view: SettingsView;
      readonly profiles: ProfilesView;
      readonly runtime: RuntimeView | null;
    }
  | { readonly type: "runtime"; readonly runtime: RuntimeView }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "reload" }
  | { readonly type: "add"; readonly input: ProfileInput }
  | { readonly type: "edit"; readonly id: string }
  | { readonly type: "draft"; readonly field: keyof ProfileInput; readonly value: string | null }
  | { readonly type: "key"; readonly typed: string }
  | { readonly type: "removeKey"; readonly remove: boolean }
  | { readonly type: "cancel" }
  | { readonly type: "working" }
  | { readonly type: "actionFailed"; readonly error: string };

export const initialState: SettingsPageState = { phase: "loading" };

const editForm = (state: Ready, id: string): ProfileForm | null => {
  const profile = state.profiles.profiles.find((p) => p.id === id);
  if (!profile) return null;
  const { name, baseUrl, model, reasoningEffort, hasKey } = profile;
  return {
    id,
    draft: { name, baseUrl, model, reasoningEffort },
    key: { ...NO_KEY, saved: hasKey },
  };
};

/** Events on a loaded page; ignored in other phases. */
const onReady = (state: Ready, event: SettingsPageEvent): Ready => {
  switch (event.type) {
    case "add":
      return { ...state, form: { id: null, draft: event.input, key: NO_KEY }, notice: null };
    case "edit":
      return { ...state, form: editForm(state, event.id), notice: null };
    case "draft": {
      if (!state.form) return state;
      const draft = { ...state.form.draft, [event.field]: event.value };
      return { ...state, form: { ...state.form, draft } };
    }
    case "key":
      return state.form
        ? {
            ...state,
            form: { ...state.form, key: { ...state.form.key, typed: event.typed, remove: false } },
          }
        : state;
    case "removeKey":
      return state.form
        ? {
            ...state,
            form: { ...state.form, key: { ...state.form.key, typed: "", remove: event.remove } },
          }
        : state;
    case "cancel":
      return { ...state, form: null, notice: null };
    case "runtime":
      return { ...state, runtime: event.runtime };
    case "working":
      return { ...state, busy: true, notice: null };
    case "actionFailed":
      return { ...state, busy: false, notice: event.error };
    default:
      return state;
  }
};

export const settingsPageReducer = (
  state: SettingsPageState,
  event: SettingsPageEvent,
): SettingsPageState => {
  switch (event.type) {
    case "loaded":
      return {
        phase: "ready",
        view: event.view,
        profiles: event.profiles,
        runtime: event.runtime,
        form: null,
        busy: false,
        notice: null,
      };
    case "failed":
      return { phase: "error", error: event.error };
    case "reload":
      return initialState;
    default:
      return state.phase === "ready" ? onReady(state, event) : state;
  }
};
