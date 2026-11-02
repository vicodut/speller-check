import type {
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseTone,
  RephraseToneMessage,
} from "@gc/protocol";
import { holdsPassage, type TextFix } from "../write-back";
import { caretInSentence } from "./caret-sentence.util";
import { RephraseEntries, type RephraseEntry } from "./rephrase-entries.store";
import { planReplace } from "./rephrase-replace.model";
import {
  addTone,
  buildRephraseView,
  pendingToneLabels,
  type RephraseVersionView,
} from "./rephrase-view.model";

export { MAX_KEPT_FIELDS } from "./rephrase-entries.store";

/** What the panel's rephrase section shows for a field. */
export type RephrasePanelState =
  | { readonly kind: "idle"; readonly enabled: boolean }
  | {
      readonly kind: "result";
      readonly versions: readonly RephraseVersionView[];
      /** Labels of the tones still loading; empty once the request is done. */
      readonly pending: readonly string[];
      /** The last Replace couldn't edit the field: this text is offered to copy instead. */
      readonly copy?: string;
    };

export type RephraseControllerDeps<F> = {
  send(message: RephraseRequestMessage): void;
  readText(field: F): string;
  readCaret(field: F): number | null;
  /** Writes an edit into the field (the write-back); false when it didn't land. */
  apply(field: F, fix: TextFix): Promise<boolean>;
  /** The field's rephrase state changed: re-render the panel and the badge marker. */
  changed(field: F): void;
  /** Backstop for a tone that never comes (worker restarted mid-request), reset per tone. */
  timeoutMs?: number;
};

/** Longer than one tone's model call plus its one JSON retry, at the core's timeout. */
const DEFAULT_TIMEOUT_MS = 150_000;

/**
 * Rephrase state per field: tones arrive one by one and the result is kept until its passage
 * changes, across panel closes and blurs. Replace writes parts into the field and the result
 * follows the new text. Never touches the issue count; a failure or a stale result goes idle.
 */
export class RephraseController<F extends object> {
  private readonly tracked = new WeakMap<F, { fieldId: string; version: number }>();
  private readonly entries = new RephraseEntries<F>();
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
    const requestId = this.nextRequestId++;
    const entry: RephraseEntry = {
      ...tracked,
      requestId,
      text,
      draft: undefined,
      loading: true,
      news: false,
      timer: undefined,
      runs: [],
      applying: false,
      copy: undefined,
    };
    this.entries.keep(field, entry);
    this.arm(entry);
    this.deps.send({ type: "rephrase.request", ...tracked, requestId, text, caret });
    this.deps.changed(field);
  }

  /** A tone or the end of a request; replies to any other request are dropped. */
  receive(message: RephraseToneMessage | RephraseDoneMessage): void {
    const found = this.entries.byId(message.fieldId);
    const [field, entry] = found ?? [];
    if (!field || !entry?.loading) return;
    if (entry.requestId !== message.requestId || entry.version !== message.version) return;
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
    const [field, entry] = this.entries.byId(fieldId) ?? [];
    if (!field || !entry?.loading || (requestId !== undefined && requestId !== entry.requestId))
      return;
    this.settle(entry);
    if (!entry.draft) this.entries.drop(field);
    this.deps.changed(field);
  }

  /** The state to render now; a result whose passage has changed is dropped. */
  state(field: F): RephrasePanelState {
    const entry = this.current(field);
    if (entry) {
      const { draft, runs, copy } = entry;
      const versions = draft ? buildRephraseView(draft, runs) : [];
      const pending = entry.loading ? pendingToneLabels(draft) : [];
      return copy === undefined
        ? { kind: "result", versions, pending }
        : { kind: "result", versions, pending, copy };
    }
    const text = this.deps.readText(field);
    const enabled = this.tracked.has(field) && caretInSentence(text, this.deps.readCaret(field));
    return { kind: "idle", enabled };
  }

  /**
   * Replace (one rewritten part, by segment index) or Replace all (no segment) for a tone.
   * Never writes over changed text: a stale result is dropped instead. A failed edit offers
   * the text to copy.
   */
  async replace(field: F, tone: RephraseTone, segment?: number): Promise<void> {
    const entry = this.current(field);
    const draft = entry?.draft;
    const version = draft?.versions.find((v) => v.tone === tone);
    if (!entry || !draft || !version || entry.applying) return;
    const plan = planReplace({ text: entry.text, ...draft }, entry.runs, version, segment);
    if (!plan) return;
    entry.applying = true;
    const applied = await this.deps.apply(field, plan.fix);
    entry.applying = false;
    if (applied) entry.runs = plan.runs;
    entry.copy = applied ? undefined : plan.fix.suggestion;
    this.deps.changed(field);
  }

  /** The panel showed the field's rephrase: clear the ready marker. */
  seen(field: F): void {
    const entry = this.entries.get(field);
    if (entry) entry.news = false;
  }

  /** Whether the badge shows the "rephrase ready" marker; a stale result has none. */
  hasNews(field: F): boolean {
    const entry = this.current(field);
    return Boolean(entry?.news && entry.draft);
  }

  /** The field's entry, unless the field no longer holds its passage (then it is dropped). */
  private current(field: F): RephraseEntry | undefined {
    const entry = this.entries.get(field);
    if (!entry?.draft || entry.applying) return entry;
    const base = { text: entry.text, ...entry.draft };
    if (holdsPassage(base, entry.runs, this.deps.readText(field))) return entry;
    this.entries.drop(field);
    return undefined;
  }

  /** (Re)starts the backstop: no tone within the timeout ends the loading state. */
  private arm(entry: RephraseEntry): void {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(
      () => this.fail(entry.fieldId, entry.requestId),
      this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  }

  private settle(entry: RephraseEntry): void {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.loading = false;
  }
}
