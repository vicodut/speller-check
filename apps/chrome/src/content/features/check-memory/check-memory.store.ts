import type { Issue } from "@gc/protocol";

/** How many fields keep their last result (and how many checks can be pending at once). */
export const MAX_REMEMBERED_FIELDS = 8;

type Pending<F> = { readonly field: F; readonly version: number; readonly text: string };
type Remembered = { readonly text: string; readonly issues: readonly Issue[] };

/**
 * In-memory only: per field, the last text sent for checking and the issues the core returned
 * for it. Never persisted. Bounded to the most recently used fields (Maps keep insertion order).
 */
export class CheckMemoryStore<F extends object> {
  private readonly pending = new Map<string, Pending<F>>();
  private readonly results = new Map<F, Remembered>();

  constructor(private readonly limit = MAX_REMEMBERED_FIELDS) {}

  /** `text` was sent as `version` of the field: its result, when it comes, is remembered. */
  sent(field: F, fieldId: string, version: number, text: string): void {
    this.pending.delete(fieldId);
    this.pending.set(fieldId, { field, version, text });
    trim(this.pending, this.limit);
  }

  /** A result arrived; remembered only if it answers the field's last sent version. */
  received(fieldId: string, version: number, issues: readonly Issue[]): boolean {
    const pending = this.pending.get(fieldId);
    if (!pending || pending.version !== version) return false;
    this.pending.delete(fieldId);
    this.results.delete(pending.field);
    this.results.set(pending.field, { text: pending.text, issues });
    trim(this.results, this.limit);
    return true;
  }

  /** True while the field's last sent version has no result yet. */
  isPending(fieldId: string): boolean {
    return this.pending.has(fieldId);
  }

  /** The check failed or will never answer: its result is not waited for. */
  dropPending(fieldId: string): void {
    this.pending.delete(fieldId);
  }

  /** The remembered issues if `text` is exactly the text they were found in. */
  recall(field: F, text: string): readonly Issue[] | undefined {
    const remembered = this.results.get(field);
    if (!remembered || remembered.text !== text) return undefined;
    this.results.delete(field);
    this.results.set(field, remembered);
    return remembered.issues;
  }

  /** E.g. after a dictionary addition, which can make any remembered issue wrong. */
  forgetResults(): void {
    this.results.clear();
  }
}

const trim = <K, V>(map: Map<K, V>, limit: number): void => {
  for (const key of map.keys()) {
    if (map.size <= limit) return;
    map.delete(key);
  }
};
