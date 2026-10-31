export type SplitText = { before: string; range: string; after: string };

/**
 * Splits `text` around [start, end) (UTF-16 offsets, clamped to the text).
 * A trailing newline gets an extra space in `after` so the mirror keeps the last empty line.
 */
export const splitAtRange = (text: string, start: number, end: number): SplitText => {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  const after = text.slice(to);
  return {
    before: text.slice(0, from),
    range: text.slice(from, to),
    after: after.endsWith("\n") ? `${after} ` : after,
  };
};
