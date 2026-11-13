import { Feature } from "@gc/protocol";
import { z } from "zod";

/** A failure's code as stored: lower-case letters and underscores only, so no text can hide in it. */
const Code = z.string().regex(/^[a-z_]{1,40}$/);

/** One ok sample: the letters it checked (at least one) and the ms it took. */
const TimedSample = z.tuple([z.number().int().positive(), z.number().nonnegative()]);

/** One row cell's numbers: one entry per feature, profile and model. */
const StatisticsEntry = z.strictObject({
  feature: Feature,
  profileId: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  local: z.boolean(),
  ok: z.array(TimedSample),
  failures: z.record(Code, z.number().int().nonnegative()),
});

/**
 * A deleted profile's last name, kept only while it has rows, so its rows can still be labelled.
 * The one name the file holds: a live profile's name is never stored.
 */
const RemovedName = z.strictObject({
  profileId: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
});

/** `statistics.json`: numbers and codes, plus the last name of each deleted profile with rows. */
export const StatisticsFile = z.strictObject({
  version: z.literal(1),
  removed: z.array(RemovedName).default([]),
  entries: z.array(StatisticsEntry),
});
export type StatisticsFile = z.infer<typeof StatisticsFile>;
export type StatisticsEntry = StatisticsFile["entries"][number];
