/**
 * Longest sent text, in UTF-16 code units, that clients send and the core checks or rephrases
 * (after email cleaning). Above it the extension shows "too long" and the core refuses the text
 * with `text_too_long`. Not a user setting.
 */
export const MAX_TEXT_LENGTH = 20_000;

/** Whether `text` is over the cap; exactly `MAX_TEXT_LENGTH` characters is still allowed. */
export const isTextTooLong = (text: string): boolean => text.length > MAX_TEXT_LENGTH;
