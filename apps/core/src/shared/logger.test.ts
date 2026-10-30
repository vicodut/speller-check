import { describe, expect, test } from "bun:test";
import { type LogFields, Logger } from "./logger";

const capture = () => {
  const lines: string[] = [];
  return { lines, logger: new Logger((line) => lines.push(line)) };
};

describe("Logger", () => {
  test("writes one JSON line with level and known fields", () => {
    const { lines, logger } = capture();
    logger.info({ event: "check.done", ms: 12.6, len: 3 });
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      { level: "info", event: "check.done", ms: 13, len: 3 },
    ]);
  });

  test("includes the error code", () => {
    const { lines, logger } = capture();
    logger.error({ event: "provider.error", code: "provider_timeout" });
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      level: "error",
      event: "provider.error",
      code: "provider_timeout",
    });
  });

  test("drops fields that are not part of LogFields", () => {
    const { lines, logger } = capture();
    const sneaky = { event: "check.start", text: "I has went" } as unknown as LogFields;
    logger.info(sneaky);
    expect(lines[0]).not.toContain("I has went");
  });
});
