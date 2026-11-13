import type { AppError } from "../../shared/errors";
import { appError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { err, ok, type Result } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import type { StatisticsFile } from "./statistics-file.schema";

/** An in-memory stand-in for the statistics file: what was last saved, and whether saves fail. */
export const memoryStore = (initial: Result<StatisticsFile | null, AppError> = ok(null)) => {
  let saved: StatisticsFile | null = null;
  const store = {
    failSaves: false,
    load: async () => (saved ? ok(structuredClone(saved)) : initial),
    save: async (file: StatisticsFile): Promise<Result<void, AppError>> => {
      if (store.failSaves) return err(appError("statistics_write_failed"));
      saved = structuredClone(file);
      return ok(undefined);
    },
  };
  return { store, saved: () => saved };
};

export const identity = { profileId: "p1", model: "qwen3:8b", local: true };

export const answered = (ms: number, letters = 100, words = 20): CallSample => ({
  kind: "ok",
  feature: "check",
  identity,
  letters,
  words,
  ms,
});

export const failed = (code: "timeout" | "invalid_json"): CallSample => ({
  kind: "failure",
  feature: "check",
  identity,
  code,
});

export const quiet = () => new Logger(() => {});
