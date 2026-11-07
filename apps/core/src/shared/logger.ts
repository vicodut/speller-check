import type { ErrorCode } from "./errors";

/** Settings whose source can be logged, and the sources a log line may name. */
const SOURCED_SETTINGS = ["baseUrl", "model", "apiKey", "reasoningEffort"] as const;
const SOURCES = new Set(["env", "saved", "default", "unset"]);
type SourcedSetting = (typeof SOURCED_SETTINGS)[number];
type Source = "env" | "saved" | "default" | "unset";

export type LogEvent =
  | "check.start"
  | "check.done"
  | "check.failed"
  | "check.batches"
  | "check.batch_done"
  | "check.batches_dropped"
  | "cache.hit"
  | "cache.miss"
  | "provider.request"
  | "provider.response"
  | "provider.error"
  | "provider.json_mode_disabled"
  | "provider.retry_after_timeout"
  | "provider.warmup"
  | "provider.warmup_failed"
  | "parse.retry"
  | "parse.failed"
  | "locate.dropped"
  | "issues.overlap_dropped"
  | "issues.echo_dropped"
  | "dictionary.loaded"
  | "dictionary.filtered"
  | "dictionary.added"
  | "dictionary.add_failed"
  | "session.stale_dropped"
  | "reconcile.dropped"
  | "server.started"
  | "server.failed"
  | "connection.opened"
  | "connection.closed"
  | "connection.rejected"
  | "message.invalid"
  | "text.edit_applied"
  | "text.resync_needed"
  | "rephrase.requested"
  | "rephrase.done"
  | "rephrase.failed"
  | "rephrase.version_dropped"
  | "rephrase.tone_done"
  | "rephrase.tone_failed"
  | "rephrase.tone_cached"
  | "settings.loaded"
  | "settings.switched"
  | "http.rejected"
  | "cli.failed";

/**
 * The only fields a log line can carry: names, durations, lengths/counts, error codes, and
 * where each setting comes from (never its value).
 */
export type LogFields = {
  readonly event: LogEvent;
  readonly ms?: number;
  readonly len?: number;
  readonly code?: ErrorCode;
  readonly sources?: Readonly<Partial<Record<SourcedSetting, Source>>>;
};

export type LogSink = (line: string) => void;

const stderrSink: LogSink = (line) => {
  process.stderr.write(`${line}\n`);
};

export class Logger {
  constructor(private readonly sink: LogSink = stderrSink) {}

  info(fields: LogFields): void {
    this.write("info", fields);
  }

  error(fields: LogFields): void {
    this.write("error", fields);
  }

  private write(level: "info" | "error", fields: LogFields): void {
    // Copy known fields only, so a cast object can't smuggle free text into the log.
    const line: Record<string, string | number | Record<string, string>> = {
      level,
      event: fields.event,
    };
    if (typeof fields.ms === "number") line.ms = Math.round(fields.ms);
    if (typeof fields.len === "number") line.len = fields.len;
    if (typeof fields.code === "string") line.code = fields.code;
    if (fields.sources) line.sources = knownSources(fields.sources);
    this.sink(JSON.stringify(line));
  }
}

/** Known setting names with a known source word; anything else (a value, a stray key) is dropped. */
const knownSources = (sources: Readonly<Record<string, unknown>>): Record<string, string> => {
  const kept: Record<string, string> = {};
  for (const name of SOURCED_SETTINGS) {
    const source = sources[name];
    if (typeof source === "string" && SOURCES.has(source)) kept[name] = source;
  }
  return kept;
};
