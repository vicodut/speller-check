import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const SRC = import.meta.dir;
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

interface SourceImport {
  file: string;
  specifier: string;
  target: string | null;
}

function sourceFiles(): string[] {
  return Array.from(new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: SRC })).map((p) => join(SRC, p));
}

function resolveImport(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function collectImports(): SourceImport[] {
  return sourceFiles().flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return Array.from(source.matchAll(IMPORT_PATTERN), (m) => {
      const specifier = m[1] ?? "";
      return { file, specifier, target: resolveImport(file, specifier) };
    });
  });
}

function featureOf(file: string): string | null {
  const rel = relative(join(SRC, "features"), file);
  if (rel.startsWith("..")) return null;
  return rel.split(sep)[0] ?? null;
}

describe("settings-web architecture", () => {
  const imports = collectImports();

  test("every relative import resolves to an existing file", () => {
    const broken = imports
      .filter((i) => i.target === null)
      .map((i) => `${relative(SRC, i.file)} -> ${i.specifier}`);
    expect(broken).toEqual([]);
  });

  test("features import each other only through their index.ts", () => {
    const violations = imports
      .filter((i) => i.target !== null)
      .filter((i) => {
        const from = featureOf(i.file);
        const to = featureOf(i.target ?? "");
        if (from === null || to === null || from === to) return false;
        return !i.target?.endsWith(join("features", to, "index.ts"));
      })
      .map((i) => `${relative(SRC, i.file)} -> ${i.specifier}`);
    expect(violations).toEqual([]);
  });
});
