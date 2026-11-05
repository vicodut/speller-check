import { applyTextEdit, type TextEdit, type TextSnapshot } from "./text-edit.util";

export type FieldTextEdit = TextEdit & { readonly fieldId: string };

/**
 * Per connection, in memory only: each open field's last received text and version, the base
 * a `text.edit` is applied to. An older full text is ignored, as the field session ignores it.
 */
export class ReceivedTexts {
  private readonly texts = new Map<string, TextSnapshot>();

  received(fieldId: string, version: number, text: string): void {
    const known = this.texts.get(fieldId);
    if (known && version <= known.version) return;
    this.texts.set(fieldId, { version, text });
  }

  /** The rebuilt text, stored as the new base; undefined when the client must resync. */
  applyEdit(edit: FieldTextEdit): string | undefined {
    const base = this.texts.get(edit.fieldId);
    const next = base && applyTextEdit(base, edit);
    if (!next) return undefined;
    this.texts.set(edit.fieldId, next);
    return next.text;
  }

  drop(fieldId: string): void {
    this.texts.delete(fieldId);
  }
}
