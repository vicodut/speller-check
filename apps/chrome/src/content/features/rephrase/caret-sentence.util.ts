// Same ICU sentence rules as the core's segmenter; the core still has the last word.
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/**
 * Whether the caret touches a sentence (either end counts), so the Rephrase button can be
 * enabled. `null` (a selection, or no caret in the field) is never inside.
 */
export const caretInSentence = (text: string, caret: number | null): boolean => {
  if (caret === null) return false;
  for (const { segment, index } of segmenter.segment(text)) {
    const start = index + (segment.length - segment.trimStart().length);
    const end = index + segment.trimEnd().length;
    if (end > start && start <= caret && caret <= end) return true;
  }
  return false;
};
