import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dir;
const outdir = join(root, "dist");

/** Bundles the settings page into dist/, which `core serve` serves at /settings. */
const build = async (): Promise<void> => {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(root, "src/index.tsx")],
    outdir,
    naming: "app.js",
    target: "browser",
    format: "esm",
    minify: true,
    // React ships its development build unless NODE_ENV is production.
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  await copyFile(join(root, "src/index.html"), join(outdir, "index.html"));
  await copyFile(join(root, "src/app.css"), join(outdir, "app.css"));
};

await build();
