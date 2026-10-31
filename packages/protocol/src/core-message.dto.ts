import { z } from "zod";
import { IssuesMessage } from "./issues-message.dto";

/** Sent once the hello token is accepted. */
export const ReadyMessage = z.object({ type: z.literal("ready") });
export type ReadyMessage = z.infer<typeof ReadyMessage>;

export const IssuesCoreMessage = IssuesMessage.extend({ type: z.literal("issues") });
export type IssuesCoreMessage = z.infer<typeof IssuesCoreMessage>;

/** An expected failure, as an error code only. `fieldId` is set when it concerns one field. */
export const ErrorMessage = z.object({
  type: z.literal("error"),
  code: z.string().min(1),
  fieldId: z.string().min(1).optional(),
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
  ErrorMessage,
  SettingsChangedMessage,
]);
export type CoreMessage = z.infer<typeof CoreMessage>;
