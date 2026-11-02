import { z } from "zod";
import { CheckRequest } from "./check-request.dto";

/** First message on every connection; anything else before it closes the socket. */
export const HelloMessage = z.object({ type: z.literal("hello"), token: z.string().min(1) });
export type HelloMessage = z.infer<typeof HelloMessage>;

export const TextChangedMessage = CheckRequest.extend({ type: z.literal("text.changed") });
export type TextChangedMessage = z.infer<typeof TextChangedMessage>;

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
 * Asks for four tones of the passage around `caret` (an offset into `text`). `requestId` is
 * chosen by the client and echoed on every reply, so replies to an older request can be told
 * apart. A newer request for the same field cancels the older one.
 */
export const RephraseRequestMessage = CheckRequest.extend({
  type: z.literal("rephrase.request"),
  requestId: z.number().int().nonnegative(),
  caret: z.number().int().nonnegative(),
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

/** Messages a client (Swift helper, Chrome extension) sends to the core. */
export const ClientMessage = z.discriminatedUnion("type", [
  HelloMessage,
  TextChangedMessage,
  FieldClosedMessage,
  DictionaryAddMessage,
  RephraseRequestMessage,
  RephraseCancelMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
