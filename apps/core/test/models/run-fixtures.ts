import { homedir } from "node:os";
import { join } from "node:path";
import { loadSettings } from "../../src/features/settings";
import { createCore } from "../../src/main";
import { Logger } from "../../src/shared/logger";
import { FIXTURE_FILES, loadFixtureFile } from "./fixture.schema";
import { type CaseScore, scoreCase } from "./fixture-scoring";

/**
 * Opt-in: runs every fixture against the model configured by GC_* env vars and reports
 * hits, misses, extra issues and dictionary violations. Exits 1 on any miss, violation or error.
 */
const fixturesDir = join(import.meta.dir, "..", "fixtures");

const settings = loadSettings(
  { ...process.env, GC_DICTIONARY_PATH: join(fixturesDir, "dictionary.json") },
  homedir(),
);
if (!settings.ok) {
  process.stderr.write("Set GC_BASE_URL and GC_MODEL (and GC_API_KEY for cloud models).\n");
  process.exit(2);
}
const core = createCore(settings.value, new Logger(() => {}));
const print = (line: string) => process.stdout.write(`${line}\n`);

const describeScore = (score: CaseScore, ms: number): string => {
  const ok = score.misses.length === 0 && score.violations.length === 0;
  const parts = [`${ok ? "✓" : "✗"} ${score.id} (${Math.round(ms)} ms)`];
  for (const hit of score.hits)
    parts.push(
      `  hit   "${hit.original}" → "${hit.suggestion}"${hit.accepted ? "" : "  (unexpected suggestion)"}`,
    );
  for (const miss of score.misses) parts.push(`  miss  "${miss}"`);
  for (const extra of score.extras)
    parts.push(`  extra "${extra.original}" → "${extra.suggestion}" [${extra.type}]`);
  for (const term of score.violations) parts.push(`  DICTIONARY VIOLATION "${term}"`);
  return parts.join("\n");
};

const totals = { expected: 0, hits: 0, accepted: 0, extras: 0, violations: 0, errors: 0 };
print(`Model: ${settings.value.model} @ ${settings.value.baseUrl}\n`);
for (const file of FIXTURE_FILES) {
  print(`— ${file}`);
  for (const fixture of await loadFixtureFile(join(fixturesDir, file))) {
    const startedAt = performance.now();
    const result = await core.checkService.check({ text: fixture.text });
    if (!result.ok) {
      totals.errors += 1;
      print(
        `✗ ${fixture.id}: ${result.error.code}${result.error.status ? ` ${result.error.status}` : ""}`,
      );
      continue;
    }
    const score = scoreCase(fixture, result.value.issues);
    totals.expected += fixture.expect.length;
    totals.hits += score.hits.length;
    totals.accepted += score.hits.filter((h) => h.accepted).length;
    totals.extras += score.extras.length;
    totals.violations += score.violations.length;
    print(describeScore(score, performance.now() - startedAt));
  }
}
print(
  `\nHits ${totals.hits}/${totals.expected} (accepted suggestions ${totals.accepted}), ` +
    `extras ${totals.extras}, dictionary violations ${totals.violations}, errors ${totals.errors}`,
);
process.exitCode =
  totals.hits < totals.expected || totals.violations > 0 || totals.errors > 0 ? 1 : 0;
