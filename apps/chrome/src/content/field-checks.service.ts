// The check side of a session: what to send on focus, input and blur, and what to draw on results.
import type {
  FieldClosedMessage,
  Issue,
  IssuesCoreMessage,
  TextChangedMessage,
} from "@gc/protocol";
import type { ConnectionStatus } from "../shared/port-messages";
import { CheckMemoryStore } from "./features/check-memory";
import type { ChangeCause, FieldWatcherCallbacks } from "./features/field-watcher";
import { messageForChange } from "./features/text-cap";
import type { WatchedField } from "./shared/issue-view";

/** How long a blurred field waits for its in-flight result before it is closed anyway. */
export const SETTLE_TIMEOUT_MS = 60_000;

type OfflineStatus = "auth_failed" | "unreachable";

export type FieldChecksDeps = {
  send(message: TextChangedMessage | FieldClosedMessage): void;
  view: {
    show(field: WatchedField, issues: readonly Issue[]): void;
    clear(field: WatchedField): void;
  };
  badge: {
    checking(field: WatchedField): void;
    done(field: WatchedField): void;
    tooLong(field: WatchedField): void;
    offline(status: OfflineStatus, field?: WatchedField): void;
    failed(field: WatchedField, code: string): void;
    hide(field?: WatchedField): void;
  };
  /** The core connection status last reported by the background. */
  status(): ConnectionStatus | undefined;
  settleMs?: number;
};

/**
 * Refocusing a field whose text is the one last checked shows that result again at once and
 * sends nothing. A blur while a check is in flight delays `field.closed` until its result
 * arrives (or SETTLE_TIMEOUT_MS), so that result is remembered too.
 */
export class FieldChecks implements FieldWatcherCallbacks {
  private readonly memory = new CheckMemoryStore<WatchedField>();
  /** Blurred fields waiting for their in-flight result before `field.closed` is sent. */
  private readonly closing = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: FieldChecksDeps) {}

  changed(
    field: WatchedField,
    fieldId: string,
    version: number,
    text: string,
    cause: ChangeCause,
  ): void {
    this.reopen(fieldId);
    const message = messageForChange({ fieldId, version, text });
    if (message.type === "field.closed") {
      // Over the cap: no text is sent and the old underlines no longer match.
      this.memory.dropPending(fieldId);
      this.deps.view.clear(field);
      this.deps.badge.tooLong(field);
    } else {
      // Only a focus reuses: an edit, or a resend after the core reconnected, always checks.
      const kept = cause === "focus" ? this.memory.recall(field, text) : undefined;
      if (kept) {
        this.reuse(field, kept);
        return;
      }
      this.memory.sent(field, fieldId, version, text);
      const status = this.deps.status();
      // While the core is unusable the background drops the text; say so instead of spinning.
      if (status === "auth_failed" || status === "unreachable")
        this.deps.badge.offline(status, field);
      else this.deps.badge.checking(field);
    }
    this.deps.send(message);
  }

  closed(field: WatchedField, fieldId: string): void {
    this.deps.badge.hide(field);
    this.deps.view.clear(field);
    if (!this.memory.isPending(fieldId)) {
      this.deps.send({ type: "field.closed", fieldId });
      return;
    }
    const timer = setTimeout(
      () => this.finishClose(fieldId),
      this.deps.settleMs ?? SETTLE_TIMEOUT_MS,
    );
    this.closing.set(fieldId, timer);
  }

  /** A result; `field` is set only when it is for the focused field's current version. */
  issues(message: IssuesCoreMessage, field: WatchedField | undefined): void {
    this.memory.received(message.fieldId, message.version, message.issues);
    if (!this.memory.isPending(message.fieldId)) this.finishClose(message.fieldId);
    if (!field) return;
    this.deps.view.show(field, message.issues);
    this.deps.badge.done(field);
  }

  /** A check failed; `field` is set when the field is still open. */
  failed(fieldId: string, code: string, field: WatchedField | undefined): void {
    this.memory.dropPending(fieldId);
    this.finishClose(fieldId);
    if (!field) return;
    this.deps.view.clear(field);
    this.deps.badge.failed(field, code);
  }

  /** The core (re)connected: checks sent before will never answer. */
  coreReady(): void {
    for (const fieldId of [...this.closing.keys()]) this.finishClose(fieldId);
  }

  /** A word was added to the dictionary: any remembered issue may now be wrong. */
  dictionaryChanged(): void {
    this.memory.forgetResults();
  }

  dispose(): void {
    for (const timer of this.closing.values()) clearTimeout(timer);
    this.closing.clear();
  }

  /** Shows the remembered result as if it had just arrived; nothing goes to the core. */
  private reuse(field: WatchedField, issues: readonly Issue[]): void {
    this.deps.badge.checking(field);
    this.deps.view.show(field, issues);
    this.deps.badge.done(field);
  }

  /** The field is open again: its deferred `field.closed` is not sent. */
  private reopen(fieldId: string): void {
    const timer = this.closing.get(fieldId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.closing.delete(fieldId);
  }

  /** Sends a deferred `field.closed`, if there is one. */
  private finishClose(fieldId: string): void {
    if (!this.closing.has(fieldId)) return;
    this.reopen(fieldId);
    this.memory.dropPending(fieldId);
    this.deps.send({ type: "field.closed", fieldId });
  }
}
