import { Logger } from "../../shared/logger";
import { ok } from "../../shared/result";
import type { CallSample } from "./call-sample.util";
import { StatisticsRecorder } from "./statistics.recorder";
import { StatisticsService } from "./statistics.service";

export const memoryStore = () => ({
  load: async () => ok(null),
  save: async () => ok(undefined),
});

export const names: Record<string, string> = { p1: "Local", p2: "Cloud" };

export const build = async (samples: CallSample[]) => {
  const recorder = new StatisticsRecorder(memoryStore(), new Logger(() => {}));
  await recorder.load();
  recorder.record(samples);
  return new StatisticsService(recorder, (id) => names[id]);
};

export const answered = (
  feature: "check" | "rephrase",
  profileId: string,
  model: string,
  ms: number,
  letters = 10,
  words = 2,
): CallSample => ({
  kind: "ok",
  feature,
  identity: { profileId, model, local: profileId === "p1" },
  letters,
  words,
  ms,
});
