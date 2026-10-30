import { z } from "zod";

export const IssueType = z.enum(["grammar", "spelling", "syntax", "punctuation"]);
export type IssueType = z.infer<typeof IssueType>;

/** One issue as returned by the model: snippets only, never offsets. */
export const ModelIssue = z.object({
  original: z.string().min(1),
  suggestion: z.string(),
  reason: z.string(),
  context: z.string(),
  type: IssueType,
});
export type ModelIssue = z.infer<typeof ModelIssue>;

export const ModelResponse = z.object({
  issues: z.array(ModelIssue),
});
export type ModelResponse = z.infer<typeof ModelResponse>;
