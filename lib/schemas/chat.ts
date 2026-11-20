import { z } from "zod";

import { ASSISTANT_MESSAGE_PREFIX, CHAT_ERROR_CODES } from "../constants/chat";

export const conversationIdSchema = z.uuid().transform((id) => id.toLowerCase());

// Compatible with SDK-generated IDs and UUIDs; ':' is reserved for assistant IDs.
export const userMessageIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const assistantMessageIdSchema = z.string().regex(
  new RegExp(`^${ASSISTANT_MESSAGE_PREFIX}[A-Za-z0-9_-]{1,128}$`),
);

// Application input policy only; loaded/streamed messages use SDK types directly.
const submittedTextPartSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string(),
});

export const submitMessageInputSchema = z.strictObject({
  id: userMessageIdSchema,
  role: z.literal("user"),
  parts: z.array(submittedTextPartSchema).min(1),
}).refine((message) => message.parts.some((part) => part.text.trim().length > 0), {
  message: "Enter a non-empty message.",
  path: ["parts"],
});

export const conversationTitleSchema = z.string().trim().min(1).max(200);

export const renameInputSchema = z.strictObject({
  title: conversationTitleSchema,
});

export const conversationMetadataSchema = z.strictObject({
  id: conversationIdSchema,
  title: conversationTitleSchema,
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export const pendingTurnSchema = z.strictObject({
  userMessageId: userMessageIdSchema,
  assistantMessageId: assistantMessageIdSchema,
}).refine((turn) => turn.assistantMessageId === `${ASSISTANT_MESSAGE_PREFIX}${turn.userMessageId}`, {
  message: "Assistant ID must match the pending user message.",
  path: ["assistantMessageId"],
});

export const conversationListSchema = z.strictObject({
  conversations: z.array(conversationMetadataSchema),
});

export const chatErrorCodeSchema = z.enum(CHAT_ERROR_CODES);

export const chatErrorSchema = z.strictObject({
  error: z.strictObject({
    code: chatErrorCodeSchema,
    message: z.string(),
  }),
});
