import {
  type FieldClosedMessage,
  isTextTooLong,
  type RephraseRequestMessage,
  type TextChangedMessage,
} from "@gc/protocol";

export type FieldChange = {
  readonly fieldId: string;
  readonly version: number;
  /** The sent text (after email cleaning): the cap is measured on it. */
  readonly text: string;
};

/**
 * What to send for a changed field. Under the cap: its text. Over it: only `field.closed`, so
 * no text leaves the page and the core and background drop any check still pending for the
 * field. The next change back under the cap sends the text again (a newer version).
 */
export const messageForChange = (change: FieldChange): TextChangedMessage | FieldClosedMessage =>
  isTextTooLong(change.text)
    ? { type: "field.closed", fieldId: change.fieldId }
    : { type: "text.changed", ...change };

/** A rephrase carries the full text too: one over the cap is never sent. */
export const canSendRephrase = (message: RephraseRequestMessage): boolean =>
  !isTextTooLong(message.text);
