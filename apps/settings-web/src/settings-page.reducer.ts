import type { SettingsView } from "@gc/protocol";

/** Everything the settings page shows. One reducer holds it all; API calls happen around it. */
export type SettingsPageState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly view: SettingsView }
  | { readonly phase: "error"; readonly error: string };

export type SettingsPageEvent =
  | { readonly type: "loaded"; readonly view: SettingsView }
  | { readonly type: "failed"; readonly error: string }
  | { readonly type: "reload" };

export const initialState: SettingsPageState = { phase: "loading" };

export const settingsPageReducer = (
  _state: SettingsPageState,
  event: SettingsPageEvent,
): SettingsPageState => {
  switch (event.type) {
    case "loaded":
      return { phase: "ready", view: event.view };
    case "failed":
      return { phase: "error", error: event.error };
    case "reload":
      return initialState;
  }
};
