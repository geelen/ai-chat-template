import {
  createJsonErrorResponseHandler,
  type ResponseHandler,
} from "@ai-sdk/provider-utils";
import type { APICallError } from "ai";
import { z } from "zod";

const workersAIErrorDataSchema = z.object({
  object: z.literal("error"),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable(),
});

export type WorkersAIErrorData = z.infer<typeof workersAIErrorDataSchema>;

export const workersAIFailedResponseHandler: ResponseHandler<APICallError> =
  createJsonErrorResponseHandler({
    errorSchema: workersAIErrorDataSchema,
    errorToMessage: (data) => data.message,
  });
