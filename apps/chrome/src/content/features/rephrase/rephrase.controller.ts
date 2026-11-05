import type {
  RephraseDoneMessage,
  RephraseRequestMessage,
  RephraseTone,
  RephraseToneMessage,
} from "@gc/protocol";
import { holdsPassage, type TextFix } from "../write-back";
import { caretInSentence } from "./caret-sentence.util";
import { newEntry, RephraseEntries, type RephraseEntry } from "./rephrase-entries.store";
import { idlePanel, type RephrasePanelState, resultPanel } from "./rephrase-panel.model";
import { planReplace } from "./rephrase-replace.model";
import { addTone, shownTones } from "./rephrase-view.model";
import { pendingAfterTone, tonesToRequest } from "./tone-picker.model";

export { MAX_KEPT_FIELDS } from "./rephrase-entries.store";
export type { RephrasePanelState } from "./rephrase-panel.model";

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
 * Rephrase state per field: each tone is asked for on its own click and added to the same
 * result, which is kept until its passage changes, across panel closes and blurs. Replace writes
 * parts into the field and the result follows the new text. Never touches the issue count; a failure or a stale result goes idle.
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

  /**
   * The tone was clicked. With a result kept, the tone is added to it (same text and caret);
   * otherwise a new result starts at the caret, which must be in a sentence.
   */
  request(field: F, tone: RephraseTone): void {
    const kept = this.current(field);
    if (kept) {
      if (!kept.applying) this.ask(field, kept, tone);
      return;
    }
    const tracked = this.tracked.get(field);
    const text = this.deps.readText(field);
    const caret = this.deps.readCaret(field);
    if (!tracked || caret === null || !caretInSentence(text, caret)) return;
    const entry = newEntry(tracked, text, caret);
    this.entries.keep(field, entry);
    this.ask(field, entry, tone);
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
      entry.pending = pendingAfterTone(entry.pending, message.tone);
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
    if (entry) return resultPanel(entry);
    const text = this.deps.readText(field);
    const enabled = this.tracked.has(field) && caretInSentence(text, this.deps.readCaret(field));
    return idlePanel(enabled);
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

  /**
   * Asks the core for `tone`, unless it is shown or on its way. A new request supersedes the
   * running one in the core, so it also carries the tones still in flight.
   */
  private ask(field: F, entry: RephraseEntry, tone: RephraseTone): void {
    const inFlight = entry.loading ? entry.pending : [];
    const tones = tonesToRequest(shownTones(entry.draft), inFlight, tone);
    if (!tones) return;
    entry.requestId = this.nextRequestId++;
    entry.loading = true;
    entry.pending = tones;
    this.arm(entry);
    const { fieldId, version, requestId, text, caret } = entry;
    this.deps.send({ type: "rephrase.request", fieldId, version, requestId, text, caret, tones });
    this.deps.changed(field);
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
    entry.pending = [];
  }
}
