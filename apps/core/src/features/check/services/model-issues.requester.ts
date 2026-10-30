import type { ModelIssue } from "@gc/protocol";
import type { AppError } from "../../../shared/errors";
import type { Logger } from "../../../shared/logger";
import type { Result } from "../../../shared/result";
import type { ChatMessage, Provider } from "../../providers";
import { JSON_RETRY_MESSAGE } from "./prompt-builder.service";
import { parseModelResponse } from "./response-parser.service";

/** Calls the model and parses its reply, retrying once if the reply isn't valid JSON. */
export const requestModelIssues = async (
  provider: Provider,
  messages: readonly ChatMessage[],
  logger: Logger,
): Promise<Result<ModelIssue[], AppError>> => {
  const first = await provider.complete(messages);
  if (!first.ok) return first;
  const parsed = parseModelResponse(first.value);
  if (parsed.ok) return parsed;

  logger.info({ event: "parse.retry", code: parsed.error.code });
  const second = await provider.complete([...messages, JSON_RETRY_MESSAGE]);
  if (!second.ok) return second;
  const reparsed = parseModelResponse(second.value);
  if (!reparsed.ok) logger.error({ event: "parse.failed", code: reparsed.error.code });
  return reparsed;
};
