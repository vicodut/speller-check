/** A field's full text at one version. */
export type TextSnapshot = { readonly version: number; readonly text: string };

/** One contiguous edit, in UTF-16 code units, made against the text at `baseVersion`. */
export type TextEdit = {
  readonly version: number;
  readonly baseVersion: number;
  readonly start: number;
  readonly deleteCount: number;
  readonly insert: string;
};

/**
 * The text after `edit`, or undefined when the edit can't be applied to `base`: made against
 * another version, not moving the version forward, or reaching past the end of the text.
 */
export const applyTextEdit = (base: TextSnapshot, edit: TextEdit): TextSnapshot | undefined => {
  if (edit.baseVersion !== base.version || edit.version <= base.version) return undefined;
  const end = edit.start + edit.deleteCount;
  if (end > base.text.length) return undefined;
  const text = base.text.slice(0, edit.start) + edit.insert + base.text.slice(end);
  return { version: edit.version, text };
};
