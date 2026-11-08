import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** SHA-256 of a file as lowercase hex, read in chunks so a multi-GB model never sits in memory. */
export const sha256File = async (path: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
};
