import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dir;
const outdir = join(root, "dist");

/** Bundles the service worker, content script and options page into dist/ (load it unpacked). */
const build = async (): Promise<void> => {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: [
      join(root, "src/background/index.ts"),
      join(root, "src/content/index.ts"),
      join(root, "src/options/index.tsx"),
    ],
    outdir,
    naming: "[dir].js",
    target: "browser",
    format: "esm",
    minify: false,
    // React ships its development build unless NODE_ENV is production.
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  await copyFile(join(root, "manifest.json"), join(outdir, "manifest.json"));
  await copyFile(join(root, "src/options/options.html"), join(outdir, "options.html"));
};

await build();
