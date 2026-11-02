import type {
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseToneMessage,
} from "@gc/protocol";
import { caretInSentence } from "./caret-sentence.util";
import {
  addTone,
  buildRephraseView,
  isPassageCurrent,
  pendingToneLabels,
  type RephraseDraft,
  type RephraseVersionView,
} from "./rephrase-view.model";

/** What the panel's rephrase section shows for a field. */
export type RephrasePanelState =
  | { readonly kind: "idle"; readonly enabled: boolean }
  | {
      readonly kind: "result";
      readonly versions: readonly RephraseVersionView[];
      /** Labels of the tones still loading; empty once the request is done. */
      readonly pending: readonly string[];
    };

export type RephraseControllerDeps<F> = {
  send(message: RephraseRequestMessage): void;
  readText(field: F): string;
  readCaret(field: F): number | null;
  /** The field's rephrase state changed: re-render the panel and the badge marker. */
  changed(field: F): void;
  /** Backstop for a tone that never comes (worker restarted mid-request), reset per tone. */
  timeoutMs?: number;
};

type Entry = {
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
};

/** Longer than one tone's model call plus its one JSON retry, at the core's timeout. */
const DEFAULT_TIMEOUT_MS = 150_000;
/** Results are kept for the last few fields only. */
export const MAX_KEPT_FIELDS = 5;

/**
 * Rephrase state per field: tones arrive one by one and the result is kept until its passage
 * changes, across panel closes and blurs. Never touches the issue count; a failure or a stale
 * result just goes back to idle.
 */
export class RephraseController<F extends object> {
  private readonly tracked = new WeakMap<F, { fieldId: string; version: number }>();
  private readonly entries = new WeakMap<F, Entry>();
  /** Fields holding an entry, oldest first; also maps replies (by field id) to their field. */
  private readonly kept = new Map<string, F>();
  private nextRequestId = 1;

  constructor(private readonly deps: RephraseControllerDeps<F>) {}

  /** The watcher sent a new version of `field`. */
  track(field: F, fieldId: string, version: number): void {
    this.tracked.set(field, { fieldId, version });
  }

  request(field: F): void {
    const tracked = this.tracked.get(field);
    if (!tracked || this.entries.get(field)?.loading) return;
    const text = this.deps.readText(field);
    const caret = this.deps.readCaret(field);
    if (caret === null || !caretInSentence(text, caret)) return;
    const entry: Entry = {
      ...tracked,
      requestId: this.nextRequestId++,
      text,
      draft: undefined,
      loading: true,
      news: false,
      timer: undefined,
    };
    this.keep(field, entry);
    this.arm(entry);
    this.deps.send({
      type: "rephrase.request",
      ...tracked,
      requestId: entry.requestId,
      text,
      caret,
    });
    this.deps.changed(field);
  }

  /** A tone or the end of a request; replies to any other request are dropped. */
  receive(message: RephraseToneMessage | RephraseDoneMessage): void {
    const found = this.find(message.fieldId, message.requestId, message.version);
    if (!found) return;
    const [field, entry] = found;
    if (message.type === "rephrase.done") {
      this.settle(entry);
    } else {
      entry.draft = addTone(entry.draft, message);
      entry.news = true;
      this.arm(entry);
    }
    this.deps.changed(field);
  }

  /** A rephrase error: end the loading state, keeping any tone already shown. */
  fail(fieldId: string, requestId: number | undefined): void {
    const field = this.kept.get(fieldId);
    const entry = field && this.entries.get(field);
    if (!field || !entry?.loading || (requestId !== undefined && requestId !== entry.requestId))
      return;
    this.settle(entry);
    if (!entry.draft) this.drop(field);
    this.deps.changed(field);
  }

  /** The state to render now; a result whose passage has changed is dropped. */
  state(field: F): RephrasePanelState {
    const text = this.deps.readText(field);
    const entry = this.entries.get(field);
    if (entry?.draft && !isPassageCurrent(entry.draft, entry.text, text)) this.drop(field);
    else if (entry) {
      const versions = entry.draft ? buildRephraseView(entry.draft) : [];
      return {
        kind: "result",
        versions,
        pending: entry.loading ? pendingToneLabels(entry.draft) : [],
      };
    }
    const enabled = this.tracked.has(field) && caretInSentence(text, this.deps.readCaret(field));
    return { kind: "idle", enabled };
  }

  /** The panel showed the field's rephrase: clear the ready marker. */
  seen(field: F): void {
    const entry = this.entries.get(field);
    if (entry) entry.news = false;
  }

  /** Whether the badge shows the "rephrase ready" marker; a stale result has none. */
  hasNews(field: F): boolean {
    const entry = this.entries.get(field);
    if (!entry?.news || !entry.draft) return false;
    return isPassageCurrent(entry.draft, entry.text, this.deps.readText(field));
  }

  private find(fieldId: string, requestId: number, version: number): [F, Entry] | undefined {
    const field = this.kept.get(fieldId);
    const entry = field && this.entries.get(field);
    if (!field || !entry?.loading || entry.requestId !== requestId || entry.version !== version)
      return undefined;
    return [field, entry];
  }

  private keep(field: F, entry: Entry): void {
    this.drop(field);
    this.entries.set(field, entry);
    this.kept.set(entry.fieldId, field);
    for (const [, oldest] of this.kept) {
      if (this.kept.size <= MAX_KEPT_FIELDS) break;
      this.drop(oldest);
    }
  }

  private drop(field: F): void {
    const entry = this.entries.get(field);
    if (!entry) return;
    this.settle(entry);
    this.entries.delete(field);
    this.kept.delete(entry.fieldId);
  }

  /** (Re)starts the backstop: no tone within the timeout ends the loading state. */
  private arm(entry: Entry): void {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(
      () => this.fail(entry.fieldId, entry.requestId),
      this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  }

  private settle(entry: Entry): void {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.loading = false;
  }
}
