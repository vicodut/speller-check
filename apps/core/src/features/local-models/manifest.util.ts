import { ModelManifest } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** Checks a manifest read from anywhere (the release's own file, a test's): shape, hashes, URLs. */
export const parseManifest = (raw: unknown): Result<ModelManifest, AppError> => {
  const parsed = ModelManifest.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(appError("manifest_invalid"));
};
