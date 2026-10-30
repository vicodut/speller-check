import { z } from "zod";
import { ModelIssue } from "./model-issue.schema";

/** A located issue. Offsets are UTF-16 code units into the checked text; `end` is exclusive. */
export const Issue = ModelIssue.extend({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
}).refine((issue) => issue.end > issue.start, { message: "end must be greater than start" });
export type Issue = z.infer<typeof Issue>;
