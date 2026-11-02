// Checking limits (spec: Checking pipeline). Tuned here, in one place; not user settings.
// The length cap shared with the extension, MAX_TEXT_LENGTH, lives in @gc/protocol.

/** Debounce after the last update of a field before checking it (step 2). */
export const DEBOUNCE_MS = 1000;

/** Most uncached sentences sent to the model in one call. */
export const BATCH_MAX_SENTENCES = 20;

/** Most characters of uncached sentence text sent to the model in one call. */
export const BATCH_MAX_CHARS = 3000;
