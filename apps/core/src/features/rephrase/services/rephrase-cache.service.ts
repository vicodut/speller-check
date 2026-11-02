import { createHash } from "node:crypto";
import type { ModelRephraseResponse, RephraseSegment, RephraseTone } from "@gc/protocol";

/** One tone's validated answer; offsets are rebuilt from each request's own split. */
export type ToneReply = {
  readonly language: ModelRephraseResponse["language"];
  readonly segments: readonly RephraseSegment[];
};

/**
 * Stable key for a passage: its sentences in order. The model only sees the numbered
 * sentences, so the space between them doesn't matter and segment indices stay valid.
 */
export const hashPassage = (sentences: readonly string[]): string =>
  createHash("sha256").update(sentences.join("\u0000"), "utf8").digest("hex");

/** In-memory LRU of validated tones, keyed by model + passage hash + tone. Never persisted. */
export class RephraseCache {
  private readonly entries = new Map<string, ToneReply>();

  constructor(private readonly capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("RephraseCache capacity must be a positive integer");
    }
  }

  get(model: string, hash: string, tone: RephraseTone): ToneReply | undefined {
    const key = cacheKey(model, hash, tone);
    const reply = this.entries.get(key);
    if (reply === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, reply);
    return reply;
  }

  set(model: string, hash: string, tone: RephraseTone, reply: ToneReply): void {
    const key = cacheKey(model, hash, tone);
    this.entries.delete(key);
    this.entries.set(key, reply);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}

const cacheKey = (model: string, hash: string, tone: RephraseTone): string =>
  `${model}\u0000${hash}\u0000${tone}`;
