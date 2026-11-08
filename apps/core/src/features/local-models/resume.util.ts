/** What to do with the partial file left by an earlier download. */
export type ResumePlan =
  | { readonly kind: "complete" }
  | { readonly kind: "fetch"; readonly offset: number; readonly discard?: true };

/** From the partial file's size and the size the manifest promises. */
export const planResume = (partSize: number, expected: number): ResumePlan => {
  if (partSize === expected) return { kind: "complete" };
  if (partSize > expected) return { kind: "fetch", offset: 0, discard: true };
  return { kind: "fetch", offset: partSize };
};

/** The request header asking for the bytes after `offset`; none for a fresh download. */
export const rangeHeader = (offset: number): Record<string, string> =>
  offset > 0 ? { range: `bytes=${offset}-` } : {};

/**
 * How to take the server's answer: `append` (206 for exactly the rest of this file), `rewrite`
 * (a 200 with the whole file: truncate and write from 0), `restart` (416: drop the partial file
 * and ask again from 0) or `fail`.
 */
export type ReplyAction = "append" | "rewrite" | "restart" | "fail";

export const classifyReply = (
  status: number,
  contentRange: string | null,
  offset: number,
  expected: number,
): ReplyAction => {
  if (status === 200) return "rewrite";
  if (offset > 0 && status === 416) return "restart";
  if (offset > 0 && status === 206) {
    return contentRange === `bytes ${offset}-${expected - 1}/${expected}` ? "append" : "fail";
  }
  return "fail";
};
