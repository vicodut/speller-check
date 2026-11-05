import { z } from "zod";
import { CheckRequest } from "./check-request.dto";
import { RephraseTones } from "./rephrase.schema";

/** First message on every connection; anything else before it closes the socket. */
export const HelloMessage = z.object({ type: z.literal("hello"), token: z.string().min(1) });
export type HelloMessage = z.infer<typeof HelloMessage>;

export const TextChangedMessage = CheckRequest.extend({ type: z.literal("text.changed") });
export type TextChangedMessage = z.infer<typeof TextChangedMessage>;

/**
 * One contiguous edit against the field's text at `baseVersion`, the last version the client
 * sent: `deleteCount` UTF-16 code units at `start` are replaced by `insert`, giving `version`.
 * The core answers an edit it can't apply (unknown field, other base, out of range) with
 * `error {code: "resync_needed", fieldId}`, and the client sends the full text again.
 */
export const TextEditMessage = z.object({
  type: z.literal("text.edit"),
  fieldId: z.string().min(1),
  version: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  deleteCount: z.number().int().nonnegative(),
  insert: z.string(),
});
export type TextEditMessage = z.infer<typeof TextEditMessage>;

export const FieldClosedMessage = z.object({
  type: z.literal("field.closed"),
  fieldId: z.string().min(1),
});
export type FieldClosedMessage = z.infer<typeof FieldClosedMessage>;

export const DictionaryAddMessage = z.object({
  type: z.literal("dictionary.add"),
  term: z.string().trim().min(1),
});
export type DictionaryAddMessage = z.infer<typeof DictionaryAddMessage>;

/**
 * Asks for tones of the passage around `caret` (an offset into `text`): the ones in `tones`,
 * or all four when it is omitted. They come in display order whatever the order asked.
 * `requestId` is chosen by the client and echoed on every reply, so replies to an older
 * request can be told apart. A newer request for the same field cancels the older one.
 */
export const RephraseRequestMessage = CheckRequest.extend({
  type: z.literal("rephrase.request"),
  requestId: z.number().int().nonnegative(),
  caret: z.number().int().nonnegative(),
  tones: RephraseTones.optional(),
});
export type RephraseRequestMessage = z.infer<typeof RephraseRequestMessage>;

/**
 * Stops the field's running rephrase (its frame went away). Closing a field doesn't: the
 * tones still arrive after a blur.
 */
export const RephraseCancelMessage = z.object({
  type: z.literal("rephrase.cancel"),
  fieldId: z.string().min(1),
});
export type RephraseCancelMessage = z.infer<typeof RephraseCancelMessage>;

/**
 * Keepalive the Chrome extension sends every 20 s while connected: Chrome stops an MV3 worker
 * after ~30 s without activity, which would drop the socket during a slow model call. Ignored.
 */
export const PingMessage = z.object({ type: z.literal("ping") });
export type PingMessage = z.infer<typeof PingMessage>;

/** Messages a client (Swift helper, Chrome extension) sends to the core. */
export const ClientMessage = z.discriminatedUnion("type", [
  HelloMessage,
  TextChangedMessage,
  TextEditMessage,
  FieldClosedMessage,
  DictionaryAddMessage,
  RephraseRequestMessage,
  RephraseCancelMessage,
  PingMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
