import type { CheckRequest, CoreMessage, RephraseResult } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import type { Result } from "../../shared/result";

/** One authenticated connection's view of the checking pipeline (FieldSessions in production). */
export type SessionPort = {
  update(request: CheckRequest): void;
  close(fieldId: string): void;
  dispose(): void;
};

/** What the transport needs from the rest of the core, wired in main.ts. */
export type ServerDeps = {
  createSession(publish: (message: CoreMessage) => void): SessionPort;
  addDictionaryTerm(term: string): Promise<Result<void, AppError>>;
  /** Four tones of the passage at `caret` (RephraseService in production). */
  rephrase(input: { text: string; caret: number }): Promise<Result<RephraseResult, AppError>>;
};
