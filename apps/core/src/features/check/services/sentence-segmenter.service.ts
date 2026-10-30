/** A sentence and its span in the source text (UTF-16 offsets, `end` exclusive). */
export type Sentence = {
  readonly text: string;
  readonly start: number;
  readonly end: number;
};

// Sentence rules are language-neutral enough in ICU to handle EN, FR and mixed text.
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Splits text into trimmed sentences, skipping whitespace-only segments. */
export const segmentSentences = (text: string): Sentence[] => {
  const sentences: Sentence[] = [];
  for (const { segment, index } of segmenter.segment(text)) {
    const leading = segment.length - segment.trimStart().length;
    const trimmed = segment.trim();
    if (trimmed.length === 0) continue;
    const start = index + leading;
    sentences.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return sentences;
};
