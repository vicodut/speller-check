import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = import.meta.dir;
const tailwind = join(root, "node_modules", ".bin", "tailwindcss");

const bundleScript = async (outdir: string): Promise<void> => {
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
    throw new Error("settings page script didn't build");
  }
};

/** Compiles src/app.css (the Tailwind entry) into one static, same-origin stylesheet. */
const buildStyle = async (outdir: string): Promise<void> => {
  const input = join(root, "src/app.css");
  const proc = Bun.spawn([tailwind, "-i", input, "-o", join(outdir, "app.css"), "--minify"], {
    cwd: root,
    stdout: "ignore",
    stderr: "pipe",
  });
  if ((await proc.exited) !== 0) {
    console.error(await new Response(proc.stderr).text());
    throw new Error("settings page style didn't build");
  }
};

/** Bundles the settings page into `outdir`, which `core serve` serves at /settings. */
export const build = async (outdir: string): Promise<void> => {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await Promise.all([bundleScript(outdir), buildStyle(outdir)]);
  await copyFile(join(root, "src/index.html"), join(outdir, "index.html"));
};

if (import.meta.main) await build(join(root, "dist"));
