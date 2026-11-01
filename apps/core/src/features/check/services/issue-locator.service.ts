import type { Issue, ModelIssue } from "@gc/protocol";
import { type AppError, appError } from "../../../shared/errors";
import { err, ok, type Result } from "../../../shared/result";
import type { Sentence } from "./sentence-segmenter.service";
import { trimEchoedContext } from "./suggestion-trimmer.service";

type Span = { readonly start: number; readonly end: number };
type Match = Span & { readonly sentence: Sentence };

const WORD_CHAR = /[\p{L}\p{N}_]/u;
const APOSTROPHES = new Set(["'", "’", "ʼ"]);
const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}_])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}_])";

const escapeChar = (ch: string): string =>
  APOSTROPHES.has(ch) ? "['’ʼ]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pattern where any whitespace run matches any whitespace run, and apostrophes are interchangeable. */
const looseSource = (snippet: string): string =>
  snippet
    .trim()
    .split(/\s+/)
    .map((word) => [...word].map(escapeChar).join(""))
    .join("\\s+");

const originalPattern = (original: string): RegExp => {
  const trimmed = original.trim();
  const before = WORD_CHAR.test(trimmed.at(0) ?? "") ? NOT_WORD_BEFORE : "";
  const after = WORD_CHAR.test(trimmed.at(-1) ?? "") ? NOT_WORD_AFTER : "";
  return new RegExp(`${before}${looseSource(trimmed)}${after}`, "gu");
};

const findAll = (pattern: RegExp, sentences: readonly Sentence[]): Match[] =>
  sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(pattern)].map((m) => ({
      sentence,
      start: sentence.start + m.index,
      end: sentence.start + m.index + m[0].length,
    })),
  );

const within = (inner: Span, outer: Span): boolean =>
  outer.start <= inner.start && inner.end <= outer.end;

/**
 * Finds the one place in `sentences` the model meant by `original` + `context`.
 * Context narrows the candidates when it matches; otherwise `original` must be unique.
 * Offsets are absolute (UTF-16), `original` is replaced by the exact source slice, and words the
 * suggestion echoes from around it are trimmed (see suggestion-trimmer).
 */
export const locateIssue = (
  issue: ModelIssue,
  sentences: readonly Sentence[],
): Result<Issue, AppError> => {
  if (issue.original.trim() === "") return err(appError("issue_not_found"));
  const originals = findAll(originalPattern(issue.original), sentences);
  const contexts = issue.context.trim()
    ? findAll(new RegExp(looseSource(issue.context), "gu"), sentences)
    : [];
  const inContext = originals.filter((o) => contexts.some((c) => within(o, c)));
  const candidates = inContext.length > 0 ? inContext : originals;

  const [match, ...rest] = candidates;
  if (!match) return err(appError("issue_not_found"));
  if (rest.length > 0) return err(appError("issue_ambiguous"));
  const local = match.start - match.sentence.start;
  const localEnd = local + (match.end - match.start);
  const original = match.sentence.text.slice(local, localEnd);
  const suggestion = trimEchoedContext(match.sentence.text, local, localEnd, issue.suggestion);
  return ok({ ...issue, original, suggestion, start: match.start, end: match.end });
};
