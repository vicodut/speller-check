import { expect, test } from "bun:test";
import { err, ok, type Result } from "./result";

test("ok and err narrow on the ok flag", () => {
  const results: Result<number, string>[] = [ok(1), err("boom")];
  const seen = results.map((r) => (r.ok ? r.value : r.error));
  expect(seen).toEqual([1, "boom"]);
});
