import type { UIMessage } from "ai";
import { z } from "zod";

export const conversationIdSchema = z.uuid().transform((id) => id.toLowerCase());

// Compatible with SDK-generated IDs and UUIDs; ':' is reserved for assistant IDs.
export const userMessageIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export function getAssistantMessageId(userMessageId: string): string {
  return `assistant:${userMessageIdSchema.parse(userMessageId)}`;
}

export const assistantMessageIdSchema = z.string().regex(/^assistant:[A-Za-z0-9_-]{1,128}$/);

const textPartSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
});

export const userMessageSchema = z.strictObject({
  id: userMessageIdSchema,
  role: z.literal("user"),
  parts: z.array(textPartSchema).min(1),
}).refine((message) => message.parts.some((part) => part.text.trim().length > 0), {
  message: "Enter a non-empty message.",
  path: ["parts"],
});

export const assistantMessageSchema = z.strictObject({
  id: assistantMessageIdSchema,
  role: z.literal("assistant"),
  parts: z.array(textPartSchema),
});

export const chatMessageSchema = z.union([userMessageSchema, assistantMessageSchema]);

// This is a narrowed SDK UIMessage, shared by useChat, streams, and reloads.
export type ChatMessage = Omit<UIMessage<never, never, never>, "role" | "parts"> &
  z.infer<typeof chatMessageSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;

// Do not accept SDK default transport fields or a messages/transcript array.
const submittedTextPartSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string(),
});

export const turnInputSchema = z.strictObject({
  message: z.strictObject({
    id: userMessageIdSchema,
    role: z.literal("user"),
    parts: z.array(submittedTextPartSchema).min(1),
  }).refine((message) => message.parts.some((part) => part.text.trim().length > 0), {
    message: "Enter a non-empty message.",
    path: ["parts"],
  }),
});
export type TurnInput = z.infer<typeof turnInputSchema>;

export const renameInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
});
export type RenameInput = z.infer<typeof renameInputSchema>;

export const conversationMetadataSchema = z.strictObject({
  id: conversationIdSchema,
  title: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ConversationMetadata = z.infer<typeof conversationMetadataSchema>;

export const pendingTurnSchema = z.strictObject({
  userMessageId: userMessageIdSchema,
  assistantMessageId: assistantMessageIdSchema,
}).refine((turn) => turn.assistantMessageId === getAssistantMessageId(turn.userMessageId), {
  message: "Assistant ID must match the pending user message.",
  path: ["assistantMessageId"],
});
export type PendingTurn = z.infer<typeof pendingTurnSchema>;

export const conversationDetailSchema = z.strictObject({
  conversation: conversationMetadataSchema,
  messages: z.array(chatMessageSchema),
  pendingTurn: pendingTurnSchema.nullable(),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export const conversationListSchema = z.strictObject({
  conversations: z.array(conversationMetadataSchema),
});
export type ConversationList = z.infer<typeof conversationListSchema>;
