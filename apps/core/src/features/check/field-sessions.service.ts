import { type CheckRequest, type CoreMessage, type Issue, isTextTooLong } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import type { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import { reconcileIssues } from "./services/issue-reconciler.service";

/** Debounce after the last update of a field before checking it (spec: Checking pipeline, step 2). */
export const DEBOUNCE_MS = 1000;

export type Checker = {
  check(input: {
    text: string;
    version?: number;
  }): Promise<Result<{ version?: number; issues: Issue[] }, AppError>>;
};
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
   * published only if its snapshot is newer, so a fresh result replaces a reconciled one.
   */
  publishedFrom: number;
  timer?: unknown;
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
    const field: Field = known ?? { id: request.fieldId, latest, publishedFrom: -1 };
    field.latest = latest;
    this.fields.set(field.id, field);
    this.cancelTimer(field);
    field.timer = this.timers.setTimeout(() => void this.run(field), this.debounceMs);
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

  private async run(field: Field): Promise<void> {
    field.timer = undefined;
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
    const result = await this.checker.check({ text: snapshot.text, version: snapshot.version });
    // Closed (or closed and reopened) fields and disposed sessions drop their results.
    if (this.disposed || this.fields.get(field.id) !== field) return;
    if (result.ok) this.publishIssues(field, snapshot, result.value.issues);
    else this.publishError(field, snapshot, result.error);
  }

  private publishIssues(field: Field, snapshot: Snapshot, issues: Issue[]): void {
    if (snapshot.version <= field.publishedFrom) {
      this.logger.info({ event: "session.stale_dropped" });
      return;
    }
    const target = field.latest;
    const kept =
      target.version === snapshot.version
        ? issues
        : reconcileIssues(issues, snapshot.text, target.text);
    if (kept.length < issues.length) {
      this.logger.info({ event: "reconcile.dropped", len: issues.length - kept.length });
    }
    field.publishedFrom = snapshot.version;
    this.publish({ type: "issues", fieldId: field.id, version: target.version, issues: kept });
  }

  private publishError(field: Field, snapshot: Snapshot, error: AppError): void {
    if (snapshot.version <= field.publishedFrom) {
      this.logger.info({ event: "session.stale_dropped" });
      return;
    }
    field.publishedFrom = snapshot.version;
    this.publish({ type: "error", code: error.code, fieldId: field.id });
  }
}
