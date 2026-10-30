import { z } from "zod";
import { Issue } from "./issue.schema";

export const IssuesMessage = z.object({
  fieldId: z.string().min(1),
  version: z.number().int().nonnegative(),
  issues: z.array(Issue),
});
export type IssuesMessage = z.infer<typeof IssuesMessage>;
