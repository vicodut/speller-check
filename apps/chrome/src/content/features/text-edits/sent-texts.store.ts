import type { TextChangedMessage, TextEditMessage } from "@gc/protocol";
import { diffText } from "./text-diff.util";

/** How many fields keep their last sent text (the base for the next edit). */
export const MAX_SENT_FIELDS = 8;

type Sent = { readonly version: number; readonly text: string };

/**
 * In memory only: per field, the last text and version sent to the core. A change is sent as
 * a `text.edit` against it, unless a full send is asked for (focus, resend, resync), the field
 * has no base, or the edit would not be smaller than the full text.
 */
export class SentTexts {
  private readonly sent = new Map<string, Sent>();

  constructor(private readonly limit = MAX_SENT_FIELDS) {}

  encode(message: TextChangedMessage, full: boolean): TextChangedMessage | TextEditMessage {
    const { fieldId, version, text } = message;
    const base = this.sent.get(fieldId);
    this.sent.delete(fieldId);
    this.sent.set(fieldId, { version, text });
    if (this.sent.size > this.limit) this.sent.delete(this.sent.keys().next().value as string);
    if (full || !base) return message;
    const diff = diffText(base.text, text);
    if (diff.insert.length >= text.length) return message;
    return { type: "text.edit", fieldId, version, baseVersion: base.version, ...diff };
  }

  /** The core dropped (or will drop) the field's text: the next send is full. */
  forget(fieldId: string): void {
    this.sent.delete(fieldId);
  }

  /** A new core connection knows no field. */
  reset(): void {
    this.sent.clear();
  }
}
