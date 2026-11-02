import type { RephraseRequestMessage, RephraseResultMessage } from "@gc/protocol";
import { caretInSentence } from "./caret-sentence.util";
import {
  buildRephraseView,
  isPassageCurrent,
  type RephraseVersionView,
} from "./rephrase-view.model";

/** What the panel's rephrase section shows for a field. */
export type RephrasePanelState =
  | { readonly kind: "idle"; readonly enabled: boolean }
  | { readonly kind: "loading" }
  | { readonly kind: "result"; readonly versions: readonly RephraseVersionView[] };

export type RephraseControllerDeps<F> = {
  send(message: RephraseRequestMessage): void;
  readText(field: F): string;
  readCaret(field: F): number | null;
  /** The field's rephrase state changed: re-render the panel. */
  changed(field: F): void;
  /** Backstop for a reply that never comes (worker restarted mid-request). */
  timeoutMs?: number;
};

type Pending = { readonly version: number; readonly text: string };
type Shown = { readonly result: RephraseResultMessage; readonly text: string };

/** Longer than the core's rephrase timeout plus its one JSON retry. */
const DEFAULT_TIMEOUT_MS = 250_000;

/**
 * Rephrase state for the focused field: idle, loading, or a read-only result. Never touches the
 * issue count; a failure or a stale result just goes back to idle.
 */
export class RephraseController<F> {
  private field: F | undefined;
  private fieldId = "";
  private version = 0;
  private pending: Pending | undefined;
  private shown: Shown | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly deps: RephraseControllerDeps<F>) {}

  /** The watcher sent a new version of `field`. */
  track(field: F, fieldId: string, version: number): void {
    if (field !== this.field) this.reset();
    this.field = field;
    this.fieldId = fieldId;
    this.version = version;
  }

  /** The field closed (blur or stop): forget everything about it. */
  forget(field: F): void {
    if (field !== this.field) return;
    this.reset();
    this.field = undefined;
  }

  request(field: F): void {
    if (field !== this.field || this.pending) return;
    const text = this.deps.readText(field);
    const caret = this.deps.readCaret(field);
    if (caret === null || !caretInSentence(text, caret)) return;
    this.shown = undefined;
    this.pending = { version: this.version, text };
    this.timer = setTimeout(() => this.fail(field), this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.deps.send({
      type: "rephrase.request",
      fieldId: this.fieldId,
      version: this.version,
      text,
      caret,
    });
    this.deps.changed(field);
  }

  receive(field: F, result: RephraseResultMessage): void {
    const pending = this.pending;
    if (field !== this.field || !pending || result.version !== pending.version) return;
    this.settle();
    if (isPassageCurrent(result, pending.text, this.deps.readText(field))) {
      this.shown = { result, text: pending.text };
    }
    this.deps.changed(field);
  }

  /** A rephrase error for the field: end the loading state, nothing else. */
  fail(field: F): void {
    if (field !== this.field || !this.pending) return;
    this.settle();
    this.deps.changed(field);
  }

  /** The state to render now; a shown result whose passage has changed is dropped. */
  state(field: F): RephrasePanelState {
    if (field !== this.field) return { kind: "idle", enabled: false };
    if (this.pending) return { kind: "loading" };
    const text = this.deps.readText(field);
    if (this.shown && isPassageCurrent(this.shown.result, this.shown.text, text)) {
      return { kind: "result", versions: buildRephraseView(this.shown.result) };
    }
    this.shown = undefined;
    return { kind: "idle", enabled: caretInSentence(text, this.deps.readCaret(field)) };
  }

  private settle(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }

  private reset(): void {
    this.settle();
    this.shown = undefined;
  }
}
