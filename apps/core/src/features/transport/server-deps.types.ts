import type { CheckRequest, CoreMessage, RephraseRequestMessage } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import type { Result } from "../../shared/result";

/** One authenticated connection's view of the checking pipeline (FieldSessions in production). */
export type SessionPort = {
  update(request: CheckRequest): void;
  close(fieldId: string): void;
  dispose(): void;
};

/** One connection's running rephrases (RephraseJobs in production). */
export type RephrasePort = {
  request(message: RephraseRequestMessage): Promise<void>;
  /** The field's text changed; an edited passage stops its rephrase. */
  edited(fieldId: string, text: string): void;
  cancel(fieldId: string): void;
  dispose(): void;
};

/** What the transport needs from the rest of the core, wired in main.ts. */
export type ServerDeps = {
  createSession(publish: (message: CoreMessage) => void): SessionPort;
  createRephraser(publish: (message: CoreMessage) => void): RephrasePort;
  addDictionaryTerm(term: string): Promise<Result<void, AppError>>;
};
