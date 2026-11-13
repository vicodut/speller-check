import type { ModelIssue } from "@gc/protocol";
import type { Logger } from "../../../shared/logger";
import {
  type ChatMessage,
  type Provider,
  type TimedModelReply,
  timedModelCall,
} from "../../providers";
import { JSON_RETRY_MESSAGE } from "./prompt-builder.service";
import { parseModelResponse } from "./response-parser.service";

/**
 * Calls the model and parses its reply, retrying once if the reply isn't valid JSON. Answers the
 * timed reply, so the caller can record each attempt.
 */
export const requestModelIssues = (
  provider: Provider,
  messages: readonly ChatMessage[],
  logger: Logger,
): Promise<TimedModelReply<ModelIssue[]>> =>
  timedModelCall({
    feature: "check",
    provider,
    messages,
    parse: parseModelResponse,
    retryMessage: JSON_RETRY_MESSAGE,
    logger,
  });
