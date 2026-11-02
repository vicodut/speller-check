import { type Sentence, segmentSentences } from "../../check";

export const MAX_PASSAGE_SENTENCES = 8;
export const MAX_PASSAGE_CHARS = 1500;

/** The sentences to rephrase and their span in the field text (`end` exclusive). */
export type Passage = {
  readonly start: number;
  readonly end: number;
  readonly sentences: readonly Sentence[];
};

/** A line holding only whitespace between two sentences ends a paragraph. */
const BLANK_LINE = /\n[^\S\n]*\n/;

/** Index of the sentence holding the caret (either end counts), or -1. */
const caretSentence = (sentences: readonly Sentence[], caret: number): number => {
  const inside = sentences.findIndex((s) => s.start <= caret && caret < s.end);
  return inside !== -1 ? inside : sentences.findIndex((s) => s.end === caret);
};

/** First and last index of the paragraph holding sentence `at`. */
const paragraphBounds = (text: string, sentences: readonly Sentence[], at: number) => {
  const breaksBefore = (i: number) =>
    BLANK_LINE.test(text.slice(sentences[i - 1]?.end ?? 0, sentences[i]?.start ?? 0));
  let first = at;
  while (first > 0 && !breaksBefore(first)) first--;
  let last = at;
  while (last < sentences.length - 1 && !breaksBefore(last + 1)) last++;
  return { first, last };
};

/** Grows a window around `at` inside [min, max], alternating after and before, within the caps. */
const capWindow = (sentences: readonly Sentence[], at: number, min: number, max: number) => {
  let from = at;
  let to = at;
  const fits = (a: number, b: number) =>
    b - a + 1 <= MAX_PASSAGE_SENTENCES &&
    (sentences[b]?.end ?? 0) - (sentences[a]?.start ?? 0) <= MAX_PASSAGE_CHARS;
  let grown = true;
  while (grown) {
    grown = false;
    if (to < max && fits(from, to + 1)) {
      to++;
      grown = true;
    }
    if (from > min && fits(from - 1, to)) {
      from--;
      grown = true;
    }
  }
  return { from, to };
};

/**
 * The paragraph holding the caret (paragraphs end at a blank line), capped to 8 sentences or
 * 1,500 characters around the caret's sentence. Undefined when the caret is in no sentence.
 */
export const selectPassage = (text: string, caret: number): Passage | undefined => {
  const sentences = segmentSentences(text);
  const at = caretSentence(sentences, caret);
  if (at === -1) return undefined;
  const { first, last } = paragraphBounds(text, sentences, at);
  const { from, to } = capWindow(sentences, at, first, last);
  const chosen = sentences.slice(from, to + 1);
  return {
    start: chosen[0]?.start ?? 0,
    end: chosen.at(-1)?.end ?? 0,
    sentences: chosen,
  };
};
