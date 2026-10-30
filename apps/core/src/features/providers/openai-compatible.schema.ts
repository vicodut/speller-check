import { z } from "zod";

export const ChatCompletionResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export const ModelListResponse = z.object({
  data: z.array(z.object({ id: z.string() })),
});
