import { ModelIssue } from "@gc/protocol";
import { z } from "zod";
import { type AppError, appError } from "../../../shared/errors";
import { err, ok, type Result } from "../../../shared/result";

const Envelope = z.union([z.object({ issues: z.array(z.unknown()) }), z.array(z.unknown())]);

/** Removes reasoning blocks and code fences, then keeps the outermost JSON value. */
const extractJson = (raw: string): string => {
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?/g, "")
    .trim();
  const first = text.search(/[[{]/);
  const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return first === -1 || last < first ? text : text.slice(first, last + 1);
};

/**
 * Parses the model reply. The envelope must be valid ({ issues: [...] }, or a bare array);
 * individual issues that fail the schema (e.g. an unknown type) are dropped, not fatal.
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
      return issue.success ? [issue.data] : [];
    }),
  );
};
