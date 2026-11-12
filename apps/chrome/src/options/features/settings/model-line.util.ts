import type { FeatureModel } from "@gc/protocol";

/** The read-only line under the status: which model checks text, and whether it leaves the Mac. */
export const modelLine = (check: FeatureModel | undefined): string | undefined =>
  check ? `Model: ${check.model} (${check.local ? "local" : "cloud"})` : undefined;
