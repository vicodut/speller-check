import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { FIXTURE_FILES, loadFixtureFile } from "../models/fixture.schema";
import { occurrences } from "../models/fixture-scoring";

describe.each(FIXTURE_FILES)("fixture %s", (file) => {
  test("is valid and every expected original and protected term occurs exactly once", async () => {
    const cases = await loadFixtureFile(join(import.meta.dir, file));
    for (const fixture of cases) {
      for (const needle of [
        ...fixture.expect.map((e) => e.original),
        ...(fixture.mustNotFlag ?? []),
      ]) {
        expect({ id: fixture.id, needle, count: occurrences(fixture.text, needle).length }).toEqual(
          {
            id: fixture.id,
            needle,
            count: 1,
          },
        );
      }
    }
  });
});
