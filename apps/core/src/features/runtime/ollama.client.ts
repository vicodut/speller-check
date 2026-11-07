/** What Ollama reports when it answers. */
export type OllamaStatus = { readonly version: string; readonly models: readonly string[] };

const TIMEOUT_MS = 1_000;

/**
 * Ollama's own HTTP API (not the OpenAI-compatible one): its version and pulled models. Null when
 * it doesn't answer, which is how "not running" is detected.
 */
export class OllamaClient {
  constructor(
    readonly origin = "http://127.0.0.1:11434",
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async status(): Promise<OllamaStatus | null> {
    try {
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      const [version, tags] = await Promise.all([
        this.fetchFn(`${this.origin}/api/version`, { signal }),
        this.fetchFn(`${this.origin}/api/tags`, { signal }),
      ]);
      if (!version.ok || !tags.ok) return null;
      const v = (await version.json()) as { version?: unknown };
      const t = (await tags.json()) as { models?: { name?: unknown }[] };
      return {
        version: typeof v.version === "string" ? v.version : "unknown",
        models: (t.models ?? []).flatMap((m) => (typeof m.name === "string" ? [m.name] : [])),
      };
    } catch {
      return null;
    }
  }
}
