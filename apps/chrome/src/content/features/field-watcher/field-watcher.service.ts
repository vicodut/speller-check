import { editableRoot, fieldText } from "../../shared/field-text";
import type { WatchedField } from "../../shared/issue-view";
import { isWatchableField } from "./field-eligibility.policy";
import { FieldRegistry } from "./field-registry.store";

/** Why a field is reported: it gained focus, its value changed, or it is sent again. */
export type ChangeCause = "focus" | "input" | "resend";

export type FieldWatcherCallbacks = {
  /** The field gained focus or its value changed. `text` is the full value. */
  changed(
    field: WatchedField,
    fieldId: string,
    version: number,
    text: string,
    cause: ChangeCause,
  ): void;
  /** The field lost focus, or stopped being watchable. */
  closed(field: WatchedField, fieldId: string): void;
};

const asWatchable = (target: EventTarget | null | undefined): WatchedField | undefined => {
  const editable = editableRoot(target);
  if (editable) return editable;
  if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) {
    return undefined;
  }
  // Belt and braces: the property reflects how the browser actually treats the input.
  if (target instanceof HTMLInputElement && target.type === "password") return undefined;
  const watchable = isWatchableField({
    tagName: target.tagName,
    type: target.getAttribute("type"),
    readOnly: target.readOnly,
    disabled: target.disabled,
  });
  return watchable ? target : undefined;
};

/** The real target, also inside open shadow roots; a contenteditable child maps to its root. */
const eventTarget = (event: Event): EventTarget | null => {
  const target = event.composedPath()[0] ?? event.target;
  return editableRoot(target) ?? target;
};

/** Watches focus and input on text fields and contenteditable regions in this frame's document. */
export class FieldWatcher {
  private readonly registry = new FieldRegistry<WatchedField>();
  private focused: WatchedField | undefined;
  private readonly listeners: [string, (event: Event) => void][] = [
    ["focusin", (event) => this.onFocus(event)],
    ["input", (event) => this.onInput(event)],
    ["focusout", (event) => this.onBlur(event)],
  ];

  constructor(
    private readonly doc: Document,
    private readonly callbacks: FieldWatcherCallbacks,
  ) {}

  start(): void {
    for (const [type, listener] of this.listeners) this.doc.addEventListener(type, listener, true);
    const active = asWatchable(this.doc.activeElement);
    if (active) this.track(active, "focus");
  }

  stop(): void {
    for (const [type, listener] of this.listeners) {
      this.doc.removeEventListener(type, listener, true);
    }
    if (this.focused) this.release(this.focused);
  }

  /** Sends the focused field again with a new version (e.g. after the core reconnected). */
  resendFocused(): void {
    if (this.focused) this.track(this.focused, "resend");
  }

  /** The open field for `fieldId` if `version` is current; undefined when stale or closed. */
  currentField(fieldId: string, version: number): WatchedField | undefined {
    return this.registry.current(fieldId, version);
  }

  /** The open field for `fieldId`, whatever its version. */
  openField(fieldId: string): WatchedField | undefined {
    return this.registry.openField(fieldId);
  }

  private onFocus(event: Event): void {
    const field = asWatchable(eventTarget(event));
    if (field) this.track(field, "focus");
  }

  private onInput(event: Event): void {
    const target = eventTarget(event);
    if (target !== this.focused || !this.focused) return;
    // The field may have turned into a password, readonly or disabled field since focus.
    if (asWatchable(target)) this.track(this.focused, "input");
    else this.release(this.focused);
  }

  private onBlur(event: Event): void {
    if (this.focused && eventTarget(event) === this.focused) this.release(this.focused);
  }

  /** Every report gets a new version, so results for earlier ones are always stale. */
  private track(field: WatchedField, cause: ChangeCause): void {
    if (this.focused && this.focused !== field) this.release(this.focused);
    this.focused = field;
    const { fieldId, version } = this.registry.bump(field);
    this.callbacks.changed(field, fieldId, version, fieldText(field), cause);
  }

  private release(field: WatchedField): void {
    if (this.focused === field) this.focused = undefined;
    const fieldId = this.registry.close(field);
    if (fieldId !== undefined) this.callbacks.closed(field, fieldId);
  }
}
