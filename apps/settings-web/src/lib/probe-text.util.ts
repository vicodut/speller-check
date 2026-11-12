/** Short words for each probe failure, from the endpoint or from the core. */
const PROBE_ERROR_TEXT: Record<string, string> = {
  unreachable: "endpoint unreachable",
  timeout: "timed out",
  key_rejected: "key rejected",
  unknown_model: "unknown model",
  bad_response: "unexpected reply",
  body_invalid: "check the base URL and model",
};

/** "key rejected", "HTTP 402", …; unknown codes are shown as they are. */
export const probeErrorText = (error: string, status?: number): string => {
  if (error === "endpoint_error") return status ? `HTTP ${status}` : "endpoint error";
  return PROBE_ERROR_TEXT[error] ?? error;
};

/** "OK, 1.2 s". */
export const testPassedText = (ms: number): string => `OK, ${(ms / 1000).toFixed(1)} s`;
