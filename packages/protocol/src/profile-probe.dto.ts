import { z } from "zod";
import { ApiKey, ReasoningEffort } from "./settings.dto";

/**
 * An endpoint as the profile form has it, saved or not. `apiKey`: a string is the key just typed,
 * null means no key, absent means the key saved for `profileId` (used only while the base URL
 * stays on the saved profile's host, so a saved key never goes to another server).
 */
export const ModelsProbe = z.strictObject({
  profileId: z.string().min(1).nullable(),
  baseUrl: z.url({ protocol: /^https?$/ }),
  apiKey: ApiKey.nullable().optional(),
});
export type ModelsProbe = z.infer<typeof ModelsProbe>;

/** `POST /api/probe/test`: the endpoint plus the model and effort the short request uses. */
export const TestProbe = z.strictObject({
  ...ModelsProbe.shape,
  model: z.string().trim().min(1).max(200),
  reasoningEffort: ReasoningEffort.nullable(),
});
export type TestProbe = z.infer<typeof TestProbe>;

/**
 * Why a probe failed. `key_rejected`: 401/403. `unknown_model`: the endpoint doesn't know the
 * model. `endpoint_error`: any other HTTP error (its status comes with it).
 */
export const ProbeError = z.enum([
  "unreachable",
  "timeout",
  "key_rejected",
  "unknown_model",
  "endpoint_error",
  "bad_response",
]);
export type ProbeError = z.infer<typeof ProbeError>;

export const ProbeFailure = z.strictObject({
  ok: z.literal(false),
  error: ProbeError,
  status: z.number().int().optional(),
});
export type ProbeFailure = z.infer<typeof ProbeFailure>;

/** `POST /api/probe/models`: the endpoint's model ids, sorted, or why they couldn't be listed. */
export const ModelsResult = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), models: z.array(z.string()) }),
  ProbeFailure,
]);
export type ModelsResult = z.infer<typeof ModelsResult>;

/** `POST /api/probe/test`: how long the one short request took, or why it failed. */
export const TestResult = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), ms: z.number().nonnegative() }),
  ProbeFailure,
]);
export type TestResult = z.infer<typeof TestResult>;
