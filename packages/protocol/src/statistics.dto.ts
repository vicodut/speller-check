import { z } from "zod";

/** One feature's cell in a row: how fast its model checks text, and how often it fails. */
export const StatisticsCell = z.strictObject({
  /** Median ms per letter to one decimal place; null until there are enough ok samples. */
  msPerLetter: z.number().nonnegative().nullable(),
  okCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  /** Letters over the ok samples only. */
  letters: z.number().int().nonnegative(),
});
export type StatisticsCell = z.infer<typeof StatisticsCell>;

/** One profile and model: its Corrections and Rephrase cells. */
export const StatisticsRow = z.strictObject({
  profileId: z.string().min(1),
  profileName: z.string(),
  /** The profile is no longer saved; its name is the last one it had. */
  deleted: z.boolean(),
  model: z.string().min(1),
  local: z.boolean(),
  check: StatisticsCell,
  rephrase: StatisticsCell,
});
export type StatisticsRow = z.infer<typeof StatisticsRow>;

/** `GET /api/statistics` (and the answer to `DELETE`): one row per profile and model. */
export const StatisticsView = z.strictObject({
  rows: z.array(StatisticsRow),
});
export type StatisticsView = z.infer<typeof StatisticsView>;
