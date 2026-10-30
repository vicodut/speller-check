import { z } from "zod";

export const ExpectedIssue = z.object({
  /** Exact, unique substring of the case text that the model should flag. */
  original: z.string().min(1),
  /** Suggestions counted as correct. Any other suggestion is reported, not counted as a miss. */
  accept: z.array(z.string()).min(1),
});
export type ExpectedIssue = z.infer<typeof ExpectedIssue>;

export const FixtureCase = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  expect: z.array(ExpectedIssue),
  mustNotFlag: z.array(z.string().min(1)).optional(),
});
export type FixtureCase = z.infer<typeof FixtureCase>;

export const FixtureFile = z.object({ cases: z.array(FixtureCase).min(1) });

export const FIXTURE_FILES = ["en.json", "fr.json", "mixed.json", "dictionary-terms.json"] as const;

export const loadFixtureFile = async (path: string): Promise<FixtureCase[]> =>
  FixtureFile.parse(await Bun.file(path).json()).cases;
