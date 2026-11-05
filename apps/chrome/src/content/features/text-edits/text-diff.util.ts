/** One contiguous edit in UTF-16 code units: `deleteCount` units at `start` become `insert`. */
export type TextDiff = {
  readonly start: number;
  readonly deleteCount: number;
  readonly insert: string;
};

const isHigh = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * The smallest single edit turning `prev` into `next`: everything between their common
 * prefix and common suffix (which never overlap). Neither end splits a surrogate pair.
 */
export const diffText = (prev: string, next: string): TextDiff => {
  const max = Math.min(prev.length, next.length);
  let prefix = 0;
  while (prefix < max && prev.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++;
  if (prefix > 0 && isHigh(prev.charCodeAt(prefix - 1))) prefix--;
  let suffix = 0;
  while (
    suffix < max - prefix &&
    prev.charCodeAt(prev.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix++;
  }
  if (suffix > 0 && isLow(next.charCodeAt(next.length - suffix))) suffix--;
  return {
    start: prefix,
    deleteCount: prev.length - prefix - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
};
