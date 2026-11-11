// Builds the Chrome extension and zips it as out/grammar-checker-extension.zip (load it unpacked
// after unzipping, or upload it to the Chrome Web Store). Used by CI; runs locally too.
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(root, "out");
const archive = join(out, "grammar-checker-extension.zip");

const run = async (cmd: string[], cwd = root): Promise<void> => {
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`failed: ${cmd.join(" ")}`);
};

await mkdir(out, { recursive: true });
await rm(archive, { force: true });
await run(["bun", "run", "--cwd", "apps/chrome", "build"]);
// Zip the folder's contents, so manifest.json sits at the archive root as the store expects.
await run(["zip", "-r", "-X", archive, "."], join(root, "apps/chrome/dist"));
process.stdout.write(`${archive}\n`);
