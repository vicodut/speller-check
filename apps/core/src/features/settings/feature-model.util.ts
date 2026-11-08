import type { FeatureModel } from "@gc/protocol";
import { isLocalUrl } from "./profiles.util";
import type { ModelConfig } from "./settings.schema";

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
};

/** What clients learn about a feature's model: its name, whether text stays here, and the host. */
export const toFeatureModel = (model: ModelConfig): FeatureModel => {
  const provider = hostOf(model.baseUrl);
  return {
    model: model.model,
    local: isLocalUrl(model.baseUrl),
    ...(provider === undefined ? {} : { provider }),
  };
};
