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

/** Asks for four tones of the passage around `caret` (an offset into `text`). */
export const RephraseRequestMessage = CheckRequest.extend({
  type: z.literal("rephrase.request"),
  caret: z.number().int().nonnegative(),
});
export type RephraseRequestMessage = z.infer<typeof RephraseRequestMessage>;

/** Messages a client (Swift helper, Chrome extension) sends to the core. */
export const ClientMessage = z.discriminatedUnion("type", [
  HelloMessage,
  TextChangedMessage,
  FieldClosedMessage,
  DictionaryAddMessage,
  RephraseRequestMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
