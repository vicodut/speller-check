import {
  DictionaryAddMessage,
  ErrorMessage,
  FieldClosedMessage,
  IssuesCoreMessage,
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseToneMessage,
  TextChangedMessage,
} from "@gc/protocol";
import { z } from "zod";

/** Name of the runtime port each content-script frame opens to the background. */
export const contentPortName = "gc-content";

/** Content script -> background, over the port. Field ids are frame-local. */
export const ContentMessage = z.discriminatedUnion("type", [
  TextChangedMessage,
  FieldClosedMessage,
  DictionaryAddMessage,
  RephraseRequestMessage,
]);
export type ContentMessage = z.infer<typeof ContentMessage>;

/** Sent to every port when the core connection becomes ready, so frames resend focused fields. */
export const CoreReadyMessage = z.object({ type: z.literal("core.ready") });
export type CoreReadyMessage = z.infer<typeof CoreReadyMessage>;

export const ConnectionStatus = z.enum(["connecting", "ready", "auth_failed", "unreachable"]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

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
  CoreStatusMessage,
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessage>;

/** One-off `chrome.runtime.sendMessage` from the options page. */
export const StatusRequest = z.object({ type: z.literal("status") });
export type StatusRequest = z.infer<typeof StatusRequest>;

export const StatusResponse = z.object({ status: ConnectionStatus });
export type StatusResponse = z.infer<typeof StatusResponse>;
