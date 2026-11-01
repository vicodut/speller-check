const isSpace = (char: string | undefined): boolean => char !== undefined && /\s/u.test(char);

/** Tails of `before` that start at a word and end at its end, longest first ("we ", "Yesterday we "). */
const wordTails = (before: string): string[] => {
  if (!isSpace(before.at(-1))) return [];
  const tails: string[] = [];
  for (let i = 0; i < before.length; i++) {
    if (!isSpace(before[i]) && (i === 0 || isSpace(before[i - 1]))) tails.push(before.slice(i));
  }
  return tails;
};

/** Heads of `after` that start at its start and end at a word (" to", " to the"), longest first. */
const wordHeads = (after: string): string[] => {
  if (!isSpace(after[0])) return [];
  const heads: string[] = [];
  for (let i = after.length; i > 0; i--) {
    if (!isSpace(after[i - 1]) && (i === after.length || isSpace(after[i]))) {
      heads.push(after.slice(0, i));
    }
  }
  return heads;
};

/**
 * Small models sometimes repeat the words around `original` in the suggestion
 * ("has went" → "I went" in "I has went"), which would duplicate them on Accept.
 * Strips whole words the suggestion echoes from right before or right after the original.
 */
export const trimEchoedContext = (
  sentence: string,
  start: number,
  end: number,
  suggestion: string,
): string => {
  let result = suggestion;
  const tail = wordTails(sentence.slice(0, start)).find(
    (t) => result.startsWith(t) && result.length > t.length,
  );
  if (tail) result = result.slice(tail.length);
  const head = wordHeads(sentence.slice(end)).find(
    (h) => result.endsWith(h) && result.length > h.length,
  );
  if (head) result = result.slice(0, result.length - head.length);
  return result;
};
