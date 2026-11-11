import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { generate } from "@gc/ui/generate";

const root = import.meta.dir;
const tailwind = join(root, "node_modules", ".bin", "tailwindcss");

const bundleScripts = async (outdir: string): Promise<void> => {
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
    throw new Error("extension scripts didn't build");
  }
};

/** Compiles the options page's Tailwind entry into one static stylesheet. */
const buildOptionsStyle = async (outdir: string): Promise<void> => {
  const input = join(root, "src/options/options.css");
  const proc = Bun.spawn([tailwind, "-i", input, "-o", join(outdir, "options.css"), "--minify"], {
    cwd: root,
    stdout: "ignore",
    stderr: "pipe",
  });
  if ((await proc.exited) !== 0) {
    console.error(await new Response(proc.stderr).text());
    throw new Error("options page style didn't build");
  }
};

/** Bundles the service worker, content script and options page into `outdir` (load it unpacked). */
export const build = async (outdir: string): Promise<void> => {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await generate();
  await Promise.all([bundleScripts(outdir), buildOptionsStyle(outdir)]);
  await copyFile(join(root, "manifest.json"), join(outdir, "manifest.json"));
  await copyFile(join(root, "src/options/options.html"), join(outdir, "options.html"));
};

if (import.meta.main) await build(join(root, "dist"));
