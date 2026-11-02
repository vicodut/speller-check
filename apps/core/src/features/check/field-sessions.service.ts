import { type CheckRequest, type CoreMessage, type Issue, isTextTooLong } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import type { CheckInput, CheckOutput } from "./check.service";
import { DEBOUNCE_MS } from "./check-limits.constants";
import { reconcileIssues } from "./services/issue-reconciler.service";

export { DEBOUNCE_MS } from "./check-limits.constants";

export type Checker = { check(input: CheckInput): Promise<Result<CheckOutput, AppError>> };
export type Publish = (message: CoreMessage) => void;
export type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};
export type FieldSessionsOptions = { readonly debounceMs?: number; readonly timers?: Timers };

type Snapshot = { readonly version: number; readonly text: string };
type Field = {
  readonly id: string;
  latest: Snapshot;
  /**
   * Snapshot version of the last published result, -1 before the first publish. A result is
   * published only if its snapshot is newer, or the same while only partial results were
   * published for it: partials pile up and the final one replaces them.
   */
  publishedFrom: number;
  /** Whether the last publish was a final one (not `pending`). */
  publishedFinal: boolean;
  timer?: unknown;
  /** A check runs for this field; a newer one waits for it (it stops after its current batch). */
  running: boolean;
  /** The debounce fired while a check was running: check the latest text once it ends. */
  rerun: boolean;
};

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Per-connection field state: debounce, snapshot, check, reconcile and publish. */
export class FieldSessions {
  private readonly fields = new Map<string, Field>();
  private readonly debounceMs: number;
  private readonly timers: Timers;
  private disposed = false;

  constructor(
    private readonly checker: Checker,
    private readonly publish: Publish,
    private readonly logger: Logger,
    options: FieldSessionsOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.timers = options.timers ?? realTimers;
  }

  update(request: CheckRequest): void {
    if (this.disposed) return;
    const known = this.fields.get(request.fieldId);
    if (known && request.version <= known.latest.version) return;
    const latest = { version: request.version, text: request.text };
    const field: Field = known ?? {
      id: request.fieldId,
      latest,
      publishedFrom: -1,
      publishedFinal: false,
      running: false,
      rerun: false,
    };
    field.latest = latest;
    this.fields.set(field.id, field);
    this.cancelTimer(field);
    field.timer = this.timers.setTimeout(() => this.start(field), this.debounceMs);
  }

  close(fieldId: string): void {
    const field = this.fields.get(fieldId);
    if (!field) return;
    this.cancelTimer(field);
    this.fields.delete(fieldId);
  }

  dispose(): void {
    for (const id of [...this.fields.keys()]) this.close(id);
    this.disposed = true;
  }

  private cancelTimer(field: Field): void {
    if (field.timer === undefined) return;
    this.timers.clearTimeout(field.timer);
    field.timer = undefined;
  }

  /** Closed (or closed and reopened) fields and disposed sessions drop their results. */
  private isOpen(field: Field): boolean {
    return !this.disposed && this.fields.get(field.id) === field;
  }

  private start(field: Field): void {
    field.timer = undefined;
    if (field.running) field.rerun = true;
    else void this.run(field);
  }

  private async run(field: Field): Promise<void> {
    field.running = true;
    try {
      await this.checkLatest(field);
    } finally {
      field.running = false;
    }
    if (!field.rerun || !this.isOpen(field)) return;
    field.rerun = false;
    void this.run(field);
  }

  private async checkLatest(field: Field): Promise<void> {
    const snapshot = field.latest;
    if (isTextTooLong(snapshot.text)) {
      // Safety net: clients don't send text over the cap. Refused before any model call.
      this.logger.error({
        event: "check.failed",
        code: "text_too_long",
        len: snapshot.text.length,
      });
      this.publishError(field, snapshot, appError("text_too_long"));
      return;
    }
    const result = await this.checker.check({
      text: snapshot.text,
      version: snapshot.version,
      onPartial: (issues) => {
        if (this.isOpen(field)) this.publishIssues(field, snapshot, issues, true);
      },
      // A newer version, a close or a dispose drops the batches not started yet.
      isSuperseded: () => !this.isOpen(field) || field.latest !== snapshot,
    });
    if (!this.isOpen(field)) return;
    // A superseded check already published what it found as a partial; the newer run finishes.
    if (result.ok && result.value.superseded) return;
    if (result.ok) this.publishIssues(field, snapshot, result.value.issues, false);
    else this.publishError(field, snapshot, result.error);
  }

  private publishIssues(field: Field, snapshot: Snapshot, issues: Issue[], pending: boolean) {
    if (!this.mayPublish(field, snapshot)) return;
    const target = field.latest;
    const kept =
      target.version === snapshot.version
        ? issues
        : reconcileIssues(issues, snapshot.text, target.text);
    if (kept.length < issues.length) {
      this.logger.info({ event: "reconcile.dropped", len: issues.length - kept.length });
    }
    this.published(field, snapshot, !pending);
    const message = { type: "issues" as const, fieldId: field.id, version: target.version };
    // A final publish carries no flag, so a single-batch check looks as it always did.
    this.publish({ ...message, issues: kept, ...(pending ? { pending: true } : {}) });
  }

  private publishError(field: Field, snapshot: Snapshot, error: AppError): void {
    if (!this.mayPublish(field, snapshot)) return;
    this.published(field, snapshot, true);
    this.publish({ type: "error", code: error.code, fieldId: field.id });
  }

  /** A newer snapshot, or the same one while only partials were published for it. */
  private mayPublish(field: Field, snapshot: Snapshot): boolean {
    const newer = snapshot.version > field.publishedFrom;
    const same = snapshot.version === field.publishedFrom && !field.publishedFinal;
    if (newer || same) return true;
    this.logger.info({ event: "session.stale_dropped" });
    return false;
  }

  private published(field: Field, snapshot: Snapshot, final: boolean): void {
    field.publishedFrom = snapshot.version;
    field.publishedFinal = final;
  }
}
