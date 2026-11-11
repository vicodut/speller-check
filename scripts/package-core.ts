// Packages the core for one macOS architecture: a single `bun --compile` binary plus the built
// settings page beside it, as out/grammar-checker-core-<arch>.tar.gz. Used by CI; runs locally too.
//   bun scripts/package-core.ts arm64|x64
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const ARCHES = ["arm64", "x64"] as const;
type Arch = (typeof ARCHES)[number];

const root = join(import.meta.dir, "..");
const out = join(root, "out");

const README = `Grammar Checker core

  ./gc-core serve      run the core on 127.0.0.1:7341 (Ctrl-C stops it)
  ./gc-core token      print the install token for the Chrome extension
  ./gc-core settings   open the settings page of the running core

Keep the settings folder next to gc-core (or set GC_SETTINGS_PAGE_DIR).
Unsigned build: if macOS blocks it, run  xattr -d com.apple.quarantine gc-core
`;

const run = async (cmd: string[]): Promise<void> => {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`failed: ${cmd.join(" ")}`);
};

const packageCore = async (arch: Arch): Promise<string> => {
  const dir = join(out, `core-${arch}`);
  const binary = join(dir, "gc-core");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await run(["bun", "run", "--cwd", "apps/settings-web", "build"]);
  await run([
    "bun",
    "build",
    "apps/core/src/cli.ts",
    "--compile",
    "--minify",
    `--target=bun-darwin-${arch}`,
    "--outfile",
    binary,
  ]);
  // Apple silicon refuses unsigned binaries: an ad-hoc signature is enough to run.
  if (process.platform === "darwin") await run(["codesign", "--force", "--sign", "-", binary]);
  await cp(join(root, "apps/settings-web/dist"), join(dir, "settings"), { recursive: true });
  await Bun.write(join(dir, "README.txt"), README);
  const archive = join(out, `grammar-checker-core-${arch}.tar.gz`);
  await run(["tar", "-czf", archive, "-C", dir, "."]);
  return archive;
};

const arch = process.argv[2];
if (!ARCHES.includes(arch as Arch)) {
  process.stderr.write("usage: bun scripts/package-core.ts arm64|x64\n");
  process.exit(2);
}
process.stdout.write(`${await packageCore(arch as Arch)}\n`);
