import { createHash } from "node:crypto";

/** Stable cache key for a sentence's exact text. */
export const hashSentence = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");
