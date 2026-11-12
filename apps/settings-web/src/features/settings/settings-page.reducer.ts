import type { ProfilesView, RuntimeView, SettingsView } from "@gc/protocol";
import { afterEdit, IDLE_PROBE, probeReducer } from "../../lib/profile-probe.reducer";
import type { KeyField, ProfileForm, SettingsPageEvent } from "../../lib/settings-page.model";

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

export const initialState: SettingsPageState = { phase: "loading" };

const editForm = (state: Ready, id: string): ProfileForm | null => {
  const profile = state.profiles.profiles.find((p) => p.id === id);
  if (!profile) return null;
  const { name, baseUrl, model, reasoningEffort, hasKey } = profile;
  return {
    id,
    draft: { name, baseUrl, model, reasoningEffort },
    key: { ...NO_KEY, saved: hasKey },
    probe: IDLE_PROBE,
  };
};

/** Edits inside the open form: the draft, the key, and its model list and Test result. */
const onForm = (form: ProfileForm, event: SettingsPageEvent): ProfileForm => {
  switch (event.type) {
    case "draft": {
      const draft = { ...form.draft, [event.field]: event.value };
      return { ...form, draft, probe: afterEdit(form.probe, event.field) };
    }
    case "key":
    case "removeKey": {
      const key =
        event.type === "key"
          ? { ...form.key, typed: event.typed, remove: false }
          : { ...form.key, typed: "", remove: event.remove };
      return { ...form, key, probe: afterEdit(form.probe, "key") };
    }
    case "probe":
      return { ...form, probe: probeReducer(form.probe, event.event) };
    default:
      return form;
  }
};

/** Events on a loaded page; ignored in other phases. */
const onReady = (state: Ready, event: SettingsPageEvent): Ready => {
  switch (event.type) {
    case "add": {
      const form = { id: null, draft: event.input, key: NO_KEY, probe: IDLE_PROBE };
      return { ...state, form, notice: null };
    }
    case "edit":
      return { ...state, form: editForm(state, event.id), notice: null };
    case "draft":
    case "key":
    case "removeKey":
    case "probe":
      return state.form ? { ...state, form: onForm(state.form, event) } : state;
    case "cancel":
      return { ...state, form: null, notice: null };
    case "runtime":
      return { ...state, runtime: event.runtime };
    case "runtimeChanged":
      return { ...state, runtime: event.runtime, busy: false, notice: null };
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
