import type { SkipMatcher } from "../../shared/text-model";
import type { EmailAdapter } from "./email-adapter.types";
import { gmailAdapter } from "./gmail.adapter";

/** Add a provider (Outlook…) by writing its adapter and listing it here. */
const ADAPTERS: readonly EmailAdapter[] = [gmailAdapter];

/** Quoted text pasted or replied anywhere isn't the writer's own. */
const isBlockquote: SkipMatcher = (element) => element.nodeName === "BLOCKQUOTE";

/** What the text model leaves out on `hostname`: blockquotes, plus its email provider's rules. */
export const skipMatcherFor = (hostname: string): SkipMatcher => {
  const adapter = ADAPTERS.find((candidate) => candidate.handles(hostname));
  if (!adapter) return isBlockquote;
  return (element) => isBlockquote(element) || adapter.skips(element);
};
