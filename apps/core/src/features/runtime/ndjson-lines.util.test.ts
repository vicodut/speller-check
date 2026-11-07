import { describe, expect, test } from "bun:test";
import { ndjsonLines } from "./ndjson-lines.util";

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

const collect = async (stream: ReadableStream<Uint8Array>) => {
  const lines: string[] = [];
  for await (const line of ndjsonLines(stream)) lines.push(line);
  return lines;
};

describe("ndjsonLines", () => {
  test("joins lines split across chunks and skips blank ones", async () => {
    expect(await collect(streamOf('{"a":1}\n{"b"', ":2}\n\n", '{"c":3}'))).toEqual([
      '{"a":1}',
      '{"b":2}',
      '{"c":3}',
    ]);
  });

  test("keeps multi-byte characters split across chunks whole", async () => {
    const bytes = new TextEncoder().encode('"é"\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual(['"é"']);
  });
});
