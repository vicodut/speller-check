import { ModelIssue } from "@gc/protocol";
import { z } from "zod";
import { type AppError, appError } from "../../../shared/errors";
import { extractJson } from "../../../shared/model-json";
import { err, ok, type Result } from "../../../shared/result";

const Envelope = z.union([z.object({ issues: z.array(z.unknown()) }), z.array(z.unknown())]);

/**
 * Parses the model reply. The envelope must be valid ({ issues: [...] }, or a bare array);
 * individual issues that fail the schema (e.g. an unknown type) or that change nothing are dropped, not fatal.
 */
export const parseModelResponse = (raw: string): Result<ModelIssue[], AppError> => {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch {
    return err(appError("model_invalid_json"));
  }
  const envelope = Envelope.safeParse(json);
  if (!envelope.success) return err(appError("model_invalid_json"));
  const items = Array.isArray(envelope.data) ? envelope.data : envelope.data.issues;
  return ok(
    items.flatMap((item) => {
      const issue = ModelIssue.safeParse(item);
      return issue.success && !isNoOp(issue.data) ? [issue.data] : [];
    }),
  );
};

/** An issue whose suggestion is the original text proposes no change. */
const isNoOp = (issue: ModelIssue): boolean => issue.suggestion.trim() === issue.original.trim();
