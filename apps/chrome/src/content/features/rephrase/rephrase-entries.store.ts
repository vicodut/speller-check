import type { RephraseTone } from "@gc/protocol";
import type { ReplacedRun } from "../write-back";
import type { RephraseDraft } from "./rephrase-view.model";

/**
 * One field's rephrase result and its running request. Every tone of it is asked for on the
 * same text and caret, so they all share one passage.
 */
export type RephraseEntry = {
  readonly fieldId: string;
  readonly version: number;
  /** The running (or last) request; replies to any other are dropped. */
  requestId: number;
  /** The field text the tones are computed on, and the caret in it. */
  readonly text: string;
  readonly caret: number;
  draft: RephraseDraft | undefined;
  loading: boolean;
  /** Tones asked for that haven't arrived yet; only meaningful while loading. */
  pending: RephraseTone[];
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

/** A new entry for the text and caret, before its first request. */
export const newEntry = (
  tracked: { readonly fieldId: string; readonly version: number },
  text: string,
  caret: number,
): RephraseEntry => ({
  ...tracked,
  requestId: 0,
  text,
  caret,
  draft: undefined,
  loading: false,
  pending: [],
  news: false,
  timer: undefined,
  runs: [],
  applying: false,
  copy: undefined,
});

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
    entry.pending = [];
    this.entries.delete(field);
    this.kept.delete(entry.fieldId);
  }
}
