import { z } from "zod";
import { IssuesMessage } from "./issues-message.dto";
import { RephraseToneResult } from "./rephrase.schema";

/**
 * The model one feature uses. `local` is false when its text leaves the machine; `provider` is
 * the host it goes to (the endpoint's host name), absent when unknown.
 */
export const FeatureModel = z.object({
  model: z.string().min(1),
  local: z.boolean(),
  provider: z.string().min(1).optional(),
});
export type FeatureModel = z.infer<typeof FeatureModel>;

/** Sent once the hello token is accepted, with the model each feature uses when the core knows. */
export const ReadyMessage = z.object({
  type: z.literal("ready"),
  check: FeatureModel.optional(),
  rephrase: FeatureModel.optional(),
});
export type ReadyMessage = z.infer<typeof ReadyMessage>;

/**
 * All issues found so far for the field's `version`. `pending: true` on every publish but the
 * last of a check run in batches (more are coming); absent on the final publish and on a
 * single-batch check. Each message is a complete issue list, so clients may ignore `pending`.
 */
export const IssuesCoreMessage = IssuesMessage.extend({
  type: z.literal("issues"),
  pending: z.boolean().optional(),
});
export type IssuesCoreMessage = z.infer<typeof IssuesCoreMessage>;

/** Which rephrase request a reply belongs to: the field, its version and the client's id. */
const RephraseReplyTo = {
  fieldId: z.string().min(1),
  version: z.number().int().nonnegative(),
  requestId: z.number().int().nonnegative(),
};

/** One validated tone, sent as soon as it is ready (tones come in display order). */
export const RephraseToneMessage = RephraseToneResult.extend({
  type: z.literal("rephrase.tone"),
  ...RephraseReplyTo,
});
export type RephraseToneMessage = z.infer<typeof RephraseToneMessage>;

/**
 * Every tone asked for has been tried and `count` of them were sent. A request with no valid
 * tone ends with a rephrase error instead.
 */
export const RephraseDoneMessage = z.object({
  type: z.literal("rephrase.done"),
  ...RephraseReplyTo,
  count: z.number().int().positive(),
});
export type RephraseDoneMessage = z.infer<typeof RephraseDoneMessage>;

/**
 * An expected failure, as an error code only. `fieldId` is set when it concerns one field;
 * `request` is "rephrase" when a rephrase failed (a check failure leaves it out), with the
 * rephrase's `requestId` when known.
 */
export const ErrorMessage = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  fieldId: z.string().min(1).optional(),
  request: z.literal("rephrase").optional(),
  requestId: z.number().int().nonnegative().optional(),
});
export type ErrorMessage = z.infer<typeof ErrorMessage>;

/** A feature's model changed: the model each feature (Check, Rephrase) uses now. */
export const SettingsChangedMessage = z.object({
  type: z.literal("settings.changed"),
  check: FeatureModel,
  rephrase: FeatureModel,
});
export type SettingsChangedMessage = z.infer<typeof SettingsChangedMessage>;

/** Messages the core sends to a client. */
export const CoreMessage = z.discriminatedUnion("type", [
  ReadyMessage,
  IssuesCoreMessage,
  RephraseToneMessage,
  RephraseDoneMessage,
  ErrorMessage,
  SettingsChangedMessage,
]);
export type CoreMessage = z.infer<typeof CoreMessage>;
