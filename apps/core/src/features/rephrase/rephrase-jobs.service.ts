import type { CoreMessage, RephraseRequestMessage } from "@gc/protocol";
import type { RephraseService } from "./rephrase.service";
import { selectPassage } from "./services/passage-selector.service";

/** The part of RephraseService the jobs need, so tests can pass a fake. */
export type Rephraser = Pick<RephraseService, "rephrase">;

type Job = {
  readonly cancel: AbortController;
  /** The request's text, and the passage span whose edit cancels the job. */
  readonly text: string;
  readonly span: { readonly start: number; readonly end: number } | undefined;
};

/**
 * One connection's running rephrases, at most one per field. Sends each tone as it is ready,
 * then `rephrase.done`, or a rephrase error (also when cancelled). A newer request for the
 * field, an edit of its passage, a cancel or the connection closing stops the remaining calls.
 */
export class RephraseJobs {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private readonly rephraser: Rephraser,
    private readonly publish: (message: CoreMessage) => void,
  ) {}

  async request(message: RephraseRequestMessage): Promise<void> {
    const { fieldId, version, requestId, text, caret } = message;
    this.cancel(fieldId);
    const passage = selectPassage(text, caret);
    const span = passage && { start: passage.start, end: passage.end };
    const job: Job = { cancel: new AbortController(), text, span };
    this.jobs.set(fieldId, job);
    const replyTo = { fieldId, version, requestId };
    const result = await this.rephraser.rephrase(
      { text, caret },
      {
        signal: job.cancel.signal,
        onTone: (tone) => this.publish({ type: "rephrase.tone", ...replyTo, ...tone }),
      },
    );
    if (this.jobs.get(fieldId) === job) this.jobs.delete(fieldId);
    if (result.ok) this.publish({ type: "rephrase.done", ...replyTo, count: result.value });
    else {
      const { code } = result.error;
      this.publish({ type: "error", code, fieldId, request: "rephrase", requestId });
    }
  }

  /** The field's text changed: a job whose passage no longer reads the same is cancelled. */
  edited(fieldId: string, text: string): void {
    const job = this.jobs.get(fieldId);
    if (!job?.span) return;
    const { start, end } = job.span;
    if (text.slice(start, end) !== job.text.slice(start, end)) this.cancel(fieldId);
  }

  cancel(fieldId: string): void {
    this.jobs.get(fieldId)?.cancel.abort();
    this.jobs.delete(fieldId);
  }

  dispose(): void {
    for (const fieldId of [...this.jobs.keys()]) this.cancel(fieldId);
  }
}
