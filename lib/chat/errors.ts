import { z } from "zod";

export const chatErrorCodeSchema = z.enum([
  "validation",
  "missing-conversation",
  "busy",
  "database",
  "generation",
]);
export type ChatErrorCode = z.infer<typeof chatErrorCodeSchema>;

export const chatErrorSchema = z.strictObject({
  error: z.strictObject({
    code: chatErrorCodeSchema,
    message: z.string(),
  }),
});
export type ChatError = z.infer<typeof chatErrorSchema>;

export const CHAT_ERROR_STATUS = {
  validation: 400,
  "missing-conversation": 404,
  busy: 409,
  database: 503,
  generation: 502,
} as const satisfies Record<ChatErrorCode, number>;

const publicMessages = {
  validation: "The request is invalid.",
  "missing-conversation": "This conversation was not found.",
  busy: "This conversation is busy. Try again after the current operation finishes.",
  database: "Conversation storage is unavailable. Please try again.",
  generation: "The response could not be completed. Reload the conversation before retrying.",
} as const satisfies Record<ChatErrorCode, string>;

// Deliberately accepts no exception, provider payload, or database details.
export function createChatError(code: ChatErrorCode): ChatError {
  return { error: { code, message: publicMessages[code] } };
}
