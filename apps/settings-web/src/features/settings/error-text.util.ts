/** What to tell the user for each error code. */
const ERROR_TEXT: Record<string, string> = {
  no_token: "This page needs the install token. Open it with `core settings`.",
  auth_failed: "The core rejected the token. Run `core settings` again to get a fresh link.",
  unreachable: "Can't reach the grammar checker core. Is it running?",
  bad_response: "The core answered with something this page doesn't understand.",
  body_invalid:
    "Check the profile: it needs a name, an http(s) base URL and a model. An API key can't hold spaces or quotes.",
  keychain_failed: "The core couldn't use the macOS Keychain, so nothing was saved.",
  profile_active: "That profile is in use. Switch to another one before deleting it.",
  profile_builtin: "The Local profile can't be deleted; you can edit it.",
  profile_in_use: "That profile is used by a feature. Move the feature to another profile first.",
  profile_not_found: "That profile no longer exists. Reload the page.",
  settings_locked: "GC_* environment variables set the model, so profiles can't be switched.",
  settings_write_failed: "The core couldn't save the settings file.",
  pull_in_progress: "Another model is being pulled. Wait for it, or cancel it.",
  ollama_unreachable: "Ollama isn't answering, so nothing can be pulled.",
  token_read_failed: "The core couldn't write a new token, so the old one still works.",
};
/** The message for an error code; an unknown code is shown as is. */
export const errorText = (code: string) => ERROR_TEXT[code] ?? `Something went wrong (${code}).`;
