export type BatchLimits = { readonly maxSentences: number; readonly maxChars: number };

/**
 * Groups sentences, in order, into batches of at most `maxSentences` sentences and `maxChars`
 * characters of sentence text. A sentence longer than `maxChars` gets a batch of its own.
 */
export const splitBatches = <S extends { readonly text: string }>(
  sentences: readonly S[],
  limits: BatchLimits,
): S[][] => {
  const batches: S[][] = [];
  let current: S[] = [];
  let chars = 0;
  for (const sentence of sentences) {
    const full =
      current.length >= limits.maxSentences || chars + sentence.text.length > limits.maxChars;
    if (current.length > 0 && full) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(sentence);
    chars += sentence.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
};
