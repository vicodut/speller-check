import type { Issue } from "@gc/protocol";

/**
 * LRU cache of per-sentence results, keyed by model + sentence hash.
 * Issue offsets are relative to the sentence. Clean sentences are stored as [].
 */
export class CheckCache {
  private readonly entries = new Map<string, readonly Issue[]>();

  constructor(private readonly capacity = 1000) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("CheckCache capacity must be a positive integer");
    }
  }

  get(model: string, hash: string): readonly Issue[] | undefined {
    const key = cacheKey(model, hash);
    const issues = this.entries.get(key);
    if (issues === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, issues);
    return issues;
  }

  set(model: string, hash: string, issues: readonly Issue[]): void {
    const key = cacheKey(model, hash);
    this.entries.delete(key);
    this.entries.set(key, issues);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

const cacheKey = (model: string, hash: string): string => `${model}\u0000${hash}`;
