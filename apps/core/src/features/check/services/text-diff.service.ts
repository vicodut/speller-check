/** One contiguous edit: `start..removedEnd` in the old text became `start..insertedEnd` in the new one. */
export type TextEdit = {
  readonly start: number;
  readonly removedEnd: number;
  readonly insertedEnd: number;
};

const isHigh = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

const commonPrefix = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length);
  let n = 0;
  while (n < max && a.charCodeAt(n) === b.charCodeAt(n)) n++;
  // Never end the prefix between the two halves of a surrogate pair.
  return n > 0 && isHigh(a.charCodeAt(n - 1)) ? n - 1 : n;
};

const commonSuffix = (a: string, b: string, prefix: number): number => {
  const max = Math.min(a.length, b.length) - prefix;
  let n = 0;
  while (n < max && a.charCodeAt(a.length - 1 - n) === b.charCodeAt(b.length - 1 - n)) n++;
  // Never start the suffix on the low half of a surrogate pair.
  return n > 0 && isLow(a.charCodeAt(a.length - n)) ? n - 1 : n;
};

/** Smallest single edit turning `before` into `after`, by common prefix and suffix (UTF-16 indices). */
export const diffTexts = (before: string, after: string): TextEdit => {
  const start = commonPrefix(before, after);
  const suffix = commonSuffix(before, after, start);
  return { start, removedEnd: before.length - suffix, insertedEnd: after.length - suffix };
};
