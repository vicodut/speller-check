import { z } from "zod";
import { IssuesMessage } from "./issues-message.dto";
import { RephraseResult } from "./rephrase.schema";

/** Sent once the hello token is accepted. */
export const ReadyMessage = z.object({ type: z.literal("ready") });
export type ReadyMessage = z.infer<typeof ReadyMessage>;

export const IssuesCoreMessage = IssuesMessage.extend({ type: z.literal("issues") });
export type IssuesCoreMessage = z.infer<typeof IssuesCoreMessage>;

export const RephraseResultMessage = RephraseResult.extend({
  type: z.literal("rephrase.result"),
  fieldId: z.string().min(1),
  version: z.number().int().nonnegative(),
});
export type RephraseResultMessage = z.infer<typeof RephraseResultMessage>;

/**
 * An expected failure, as an error code only. `fieldId` is set when it concerns one field;
 * `request` is "rephrase" when a rephrase failed (a check failure leaves it out).
 */
export const ErrorMessage = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  fieldId: z.string().min(1).optional(),
  request: z.literal("rephrase").optional(),
});
export type ErrorMessage = z.infer<typeof ErrorMessage>;

/** The active model changed. `local` is false when text leaves the machine. */
export const SettingsChangedMessage = z.object({
  type: z.literal("settings.changed"),
  model: z.string().min(1),
  local: z.boolean(),
});
export type SettingsChangedMessage = z.infer<typeof SettingsChangedMessage>;

/** Messages the core sends to a client. */
export const CoreMessage = z.discriminatedUnion("type", [
  ReadyMessage,
  IssuesCoreMessage,
  RephraseResultMessage,
  ErrorMessage,
  SettingsChangedMessage,
]);
export type CoreMessage = z.infer<typeof CoreMessage>;
