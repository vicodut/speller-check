import {
  DictionaryAddMessage,
  ErrorMessage,
  FeatureModel,
  FieldClosedMessage,
  IssuesCoreMessage,
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseToneMessage,
  TextChangedMessage,
  TextEditMessage,
} from "@gc/protocol";
import { z } from "zod";

/** Name of the runtime port each content-script frame opens to the background. */
export const contentPortName = "gc-content";

/** Content script -> background, over the port. Field ids are frame-local. */
export const ContentMessage = z.discriminatedUnion("type", [
  TextChangedMessage,
  TextEditMessage,
  FieldClosedMessage,
  DictionaryAddMessage,
  RephraseRequestMessage,
]);
export type ContentMessage = z.infer<typeof ContentMessage>;

/** Sent to every port when the core connection becomes ready, so frames resend focused fields. */
export const CoreReadyMessage = z.object({ type: z.literal("core.ready") });
export type CoreReadyMessage = z.infer<typeof CoreReadyMessage>;

/**
 * Sent to every port when the core switched model (a settings change): remembered results came
 * from the old model, so frames forget them and check their focused field again.
 */
export const CoreModelChangedMessage = z.object({
  type: z.literal("core.model_changed"),
  check: FeatureModel,
  rephrase: FeatureModel,
});
export type CoreModelChangedMessage = z.infer<typeof CoreModelChangedMessage>;

/**
 * Sent to a port when it attaches and whenever the core reports its models (at connect and on a
 * settings change): the badge and panel show where text goes. Unlike `core.model_changed`, it
 * never makes frames check again.
 */
export const CoreModelsMessage = z.object({
  type: z.literal("core.models"),
  check: FeatureModel,
  rephrase: FeatureModel,
});
export type CoreModelsMessage = z.infer<typeof CoreModelsMessage>;

/**
 * `auth_failed`: no token, or the core rejected it. `unverified`: what answered on the core's
 * port could not prove the token (something else may be listening there); nothing is sent.
 */
export const ConnectionStatus = z.enum([
  "connecting",
  "ready",
  "auth_failed",
  "unverified",
  "unreachable",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

/** The core can't be used: field text is dropped, and the badge says why. */
export type OfflineStatus = Exclude<ConnectionStatus, "connecting" | "ready">;

export const isOffline = (status: ConnectionStatus): status is OfflineStatus =>
  status !== "connecting" && status !== "ready";

/** Sent to a port when it attaches and to every port when the core connection status changes. */
export const CoreStatusMessage = z.object({
  type: z.literal("core.status"),
  status: ConnectionStatus,
});
export type CoreStatusMessage = z.infer<typeof CoreStatusMessage>;

/** Background -> content script, over the port. Field ids are frame-local again. */
export const BackgroundMessage = z.discriminatedUnion("type", [
  IssuesCoreMessage,
  RephraseToneMessage,
  RephraseDoneMessage,
  ErrorMessage,
  CoreReadyMessage,
  CoreModelChangedMessage,
  CoreModelsMessage,
  CoreStatusMessage,
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessage>;

/** One-off `chrome.runtime.sendMessage` from the options page. */
export const StatusRequest = z.object({ type: z.literal("status") });
export type StatusRequest = z.infer<typeof StatusRequest>;

export const StatusResponse = z.object({
  status: ConnectionStatus,
  /** The model the check feature uses, once the core has said (read-only on the options page). */
  check: FeatureModel.optional(),
});
export type StatusResponse = z.infer<typeof StatusResponse>;
