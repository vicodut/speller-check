import type { SkipMatcher } from "../../shared/text-model";

/** One email provider's rules: which host it serves and which parts of a draft aren't the writer's. */
export type EmailAdapter = {
  readonly handles: (hostname: string) => boolean;
  /** Quote, signature and similar containers to leave out of the field's text. */
  readonly skips: SkipMatcher;
};
