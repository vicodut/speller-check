export type ErrorCode =
  | "settings_invalid"
  | "provider_timeout"
  | "provider_network"
  | "provider_http"
  | "provider_bad_response"
  | "provider_cancelled"
  | "model_invalid_json"
  | "dictionary_read_failed"
  | "dictionary_invalid"
  | "issue_not_found"
  | "issue_ambiguous"
  | "dictionary_write_failed"
  | "token_read_failed"
  | "auth_failed"
  | "message_invalid"
  | "server_start_failed"
  | "origin_forbidden"
  | "rephrase_no_sentence"
  | "rephrase_no_valid_version"
  | "rephrase_cancelled";

/** Expected failure. Carries a code and optional HTTP status, never user text. */
export type AppError = { readonly code: ErrorCode; readonly status?: number };

export const appError = (code: ErrorCode, status?: number): AppError =>
  status === undefined ? { code } : { code, status };
