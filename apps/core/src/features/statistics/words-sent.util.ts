/**
 * The words of one model call: each text's whitespace-separated tokens, counted on the same texts
 * as the letters (see lettersSent). Each text is counted on its own, so no word joins across two
 * texts. Meaningless for languages written without spaces (Chinese, Japanese, Thai).
 */
export const wordsSent = (texts: readonly string[]): number =>
  texts.reduce((sum, text) => sum + (text.match(/\S+/g)?.length ?? 0), 0);
