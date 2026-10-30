import { z } from "zod";

export const CheckRequest = z.object({
  fieldId: z.string().min(1),
  version: z.number().int().nonnegative(),
  text: z.string(),
});
export type CheckRequest = z.infer<typeof CheckRequest>;
