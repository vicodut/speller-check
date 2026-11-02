import type { ReplacedRun } from "../write-back";
import type { RephraseDraft } from "./rephrase-view.model";

/** One field's rephrase request and what came of it. */
export type RephraseEntry = {
  readonly fieldId: string;
  readonly version: number;
  readonly requestId: number;
  /** The field text the request was computed on. */
  readonly text: string;
  draft: RephraseDraft | undefined;
  loading: boolean;
  /** A tone arrived that the panel hasn't shown yet: the badge's "rephrase ready" marker. */
  news: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** Parts written into the field so far by Replace / Replace all. */
  runs: ReplacedRun[];
  /** A Replace is being written: the field is mid-edit, so it isn't judged stale. */
  applying: boolean;
  /** The last Replace couldn't edit the field: its text, offered to copy. */
  copy: string | undefined;
};

/** Results are kept for the last few fields only. */
export const MAX_KEPT_FIELDS = 5;

/** The rephrase entry of each field, for the last few fields; also finds a field by its id. */
export class RephraseEntries<F extends object> {
  private readonly entries = new WeakMap<F, RephraseEntry>();
  /** Fields holding an entry, oldest first. */
  private readonly kept = new Map<string, F>();

  get(field: F): RephraseEntry | undefined {
    return this.entries.get(field);
  }

  byId(fieldId: string): [F, RephraseEntry] | undefined {
    const field = this.kept.get(fieldId);
    const entry = field && this.entries.get(field);
    return field && entry ? [field, entry] : undefined;
  }

  keep(field: F, entry: RephraseEntry): void {
    this.drop(field);
    this.entries.set(field, entry);
    this.kept.set(entry.fieldId, field);
    for (const [, oldest] of this.kept) {
      if (this.kept.size <= MAX_KEPT_FIELDS) break;
      this.drop(oldest);
    }
  }

  drop(field: F): void {
    const entry = this.entries.get(field);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.loading = false;
    this.entries.delete(field);
    this.kept.delete(entry.fieldId);
  }
}
