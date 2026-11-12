import type { OllamaPullView } from "@gc/protocol";

const UNITS = ["B", "kB", "MB", "GB", "TB"];

/** Decimal units, as Ollama shows sizes: 5.2 GB, 271 MB. */
export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const shown = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${shown} ${UNITS[unit]}`;
};

/** A pull still running: the page polls and shows a progress bar. */
export const isPulling = (pull: OllamaPullView | null): boolean =>
  pull !== null && pull.step !== "done" && pull.step !== "failed";

/** The text next to the progress bar. */
export const pullLabel = (pull: OllamaPullView): string => {
  if (pull.step === "starting") return "Preparing…";
  if (pull.step === "verifying") return "Verifying…";
  const percent = pull.total > 0 ? Math.floor((pull.completed / pull.total) * 100) : 0;
  return `${formatBytes(pull.completed)} of ${formatBytes(pull.total)} · ${percent}%`;
};
