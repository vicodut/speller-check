import type { ModelIssue } from "@gc/protocol";
import type { AppError } from "../../../shared/errors";
import type { Logger } from "../../../shared/logger";
import type { Result } from "../../../shared/result";
import { type ChatMessage, type Provider, timedModelCall } from "../../providers";
import { JSON_RETRY_MESSAGE } from "./prompt-builder.service";
import { parseModelResponse } from "./response-parser.service";

/** Calls the model and parses its reply, retrying once if the reply isn't valid JSON. */
export const requestModelIssues = async (
  provider: Provider,
  messages: readonly ChatMessage[],
  logger: Logger,
): Promise<Result<ModelIssue[], AppError>> => {
  const timed = await timedModelCall({
    feature: "check",
    provider,
    messages,
    parse: parseModelResponse,
    retryMessage: JSON_RETRY_MESSAGE,
    logger,
  });
  return timed.result;
};
