import { ModelRephraseResponse } from "@gc/protocol";
import { type AppError, appError } from "../../../shared/errors";
import { extractJson } from "../../../shared/model-json";
import { err, ok, type Result } from "../../../shared/result";

/** Parses the reply envelope; each version is validated later against the sentence split. */
export const parseRephraseResponse = (raw: string): Result<ModelRephraseResponse, AppError> => {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch {
    return err(appError("model_invalid_json"));
  }
  const envelope = ModelRephraseResponse.safeParse(json);
  return envelope.success ? ok(envelope.data) : err(appError("model_invalid_json"));
};
