export type ErrorCode =
  | "settings_invalid"
  | "provider_timeout"
  | "provider_network"
  | "provider_http"
  | "provider_bad_response"
  | "model_invalid_json"
  | "dictionary_read_failed"
  | "dictionary_invalid";

/** Expected failure. Carries a code and optional HTTP status, never user text. */
export type AppError = { readonly code: ErrorCode; readonly status?: number };

export const appError = (code: ErrorCode, status?: number): AppError =>
  status === undefined ? { code } : { code, status };
