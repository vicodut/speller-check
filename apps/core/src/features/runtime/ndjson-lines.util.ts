/** Yields each non-empty line of a streamed body (NDJSON), as bytes arrive. */
export async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield line;
  }
  buffered += decoder.decode();
  if (buffered.trim()) yield buffered;
}
