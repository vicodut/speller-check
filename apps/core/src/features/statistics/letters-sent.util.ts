/**
 * The letters of one model call: every character (UTF-16 code unit, as the text length cap counts)
 * of the text sent in its user message. The system prompt is left out, since it is the same on
 * every call. Pass the same texts the prompt carries, so the median and the totals agree.
 */
export const lettersSent = (texts: readonly string[]): number =>
  texts.reduce((sum, text) => sum + text.length, 0);
