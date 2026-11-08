import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

/** An open partial file; closing it flushes what was written. */
export type PartWriter = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

const sizeOf = async (path: string): Promise<number | null> =>
  stat(path).then(
    (info) => info.size,
    () => null,
  );

/**
 * The app's models folder. A download lives in `<file>.part` until its SHA-256 matches, then is
 * renamed to `<file>`, so a file under its final name has always been verified. The only code
 * that touches these files; fs errors are thrown for the caller to turn into an error code.
 */
export class ModelFiles {
  constructor(private readonly dir: string) {}

  /** Size of the verified file, or null when there isn't one. */
  finalSize(file: string): Promise<number | null> {
    return sizeOf(join(this.dir, file));
  }

  /** Size of the partial file left by an interrupted download, or null. */
  partSize(file: string): Promise<number | null> {
    return sizeOf(this.partPath(file));
  }

  partPath(file: string): string {
    return join(this.dir, `${file}.part`);
  }

  /** Opens the partial file to append to (resume) or from scratch (truncate). */
  async openPart(file: string, mode: "append" | "truncate"): Promise<PartWriter> {
    await mkdir(this.dir, { recursive: true });
    const handle = await open(this.partPath(file), mode === "append" ? "a" : "w");
    return {
      write: async (chunk) => {
        await handle.write(chunk);
      },
      close: () => handle.close(),
    };
  }

  /** Makes a verified partial file the model. */
  finalize(file: string): Promise<void> {
    return rename(this.partPath(file), join(this.dir, file));
  }

  removePart(file: string): Promise<void> {
    return rm(this.partPath(file), { force: true });
  }

  removeFinal(file: string): Promise<void> {
    return rm(join(this.dir, file), { force: true });
  }
}
