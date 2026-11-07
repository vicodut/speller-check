import type { ProbeFailure } from "@gc/protocol";

/**
 * How endpoints say a model doesn't exist in a 400/422 body: OpenRouter "is not a valid model
 * ID", OpenAI "The model `x` does not exist", Ollama `model "x" not found`.
 */
const UNKNOWN_MODEL =
  /model\b[^.]*\b(not found|does not exist|not a valid|invalid|unknown)|(invalid|unknown|not a valid) model/i;

/**
 * Classifies an HTTP error reply. The body is only matched here, never logged or returned.
 */
export const httpFailure = (status: number, body: string): ProbeFailure => {
  if (status === 401 || status === 403) return { ok: false, error: "key_rejected", status };
  if (status === 404) return { ok: false, error: "unknown_model", status };
  if ((status === 400 || status === 422) && UNKNOWN_MODEL.test(body))
    return { ok: false, error: "unknown_model", status };
  return { ok: false, error: "endpoint_error", status };
};

/** A fetch that threw: our timeout fired, or the endpoint couldn't be reached at all. */
export const thrownFailure = (cause: unknown): ProbeFailure =>
  cause instanceof DOMException && cause.name === "TimeoutError"
    ? { ok: false, error: "timeout" }
    : { ok: false, error: "unreachable" };
