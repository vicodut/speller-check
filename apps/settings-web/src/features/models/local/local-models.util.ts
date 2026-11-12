import type { LocalModelsView, LocalModelView } from "@gc/protocol";
import { formatBytes } from "../ollama/pull-progress.util";

/** A download that is still going: the page polls and shows a progress bar. */
export const isDownloading = (model: LocalModelView): boolean =>
  model.state === "downloading" || model.state === "verifying";

export const anyDownloading = (view: LocalModelsView | null): boolean =>
  view?.models.some(isDownloading) ?? false;

/** The text next to the progress bar. */
export const downloadLabel = (model: LocalModelView): string => {
  if (model.state === "verifying") return "Verifying…";
  const percent = Math.floor((model.completed / model.sizeBytes) * 100);
  return `${formatBytes(model.completed)} of ${formatBytes(model.sizeBytes)} · ${percent}%`;
};

const GIB = 1024 ** 3;
const gib = (bytes: number) => `${Math.round((bytes / GIB) * 10) / 10} GB`;

/** "Needs about 8 GB of memory; this Mac has 4 GB." when the Mac is short, else null. */
export const ramWarningText = (model: LocalModelView, memoryBytes: number): string | null =>
  model.ramWarning && model.ramBytes
    ? `Needs about ${gib(model.ramBytes)} of memory; this Mac has ${gib(memoryBytes)}. It may be slow or fail to load.`
    : null;

/** "19/20 on the fixtures" or "not benchmarked yet". */
export const scoreText = (model: LocalModelView): string =>
  model.fixtureScore
    ? `${model.fixtureScore.passed}/${model.fixtureScore.total} on the fixtures`
    : "not benchmarked yet";
