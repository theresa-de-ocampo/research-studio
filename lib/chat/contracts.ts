import type { UIMessage } from "ai";
import { z } from "zod";

export const conversationIdSchema = z.uuid().transform((id) => id.toLowerCase());

// Compatible with SDK-generated IDs and UUIDs; ':' is reserved for assistant IDs.
export const userMessageIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export function getAssistantMessageId(userMessageId: string): string {
  return `assistant:${userMessageIdSchema.parse(userMessageId)}`;
}

export const assistantMessageIdSchema = z.string().regex(/^assistant:[A-Za-z0-9_-]{1,128}$/);

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
export type SubmitMessageInput = z.infer<typeof submitMessageInputSchema>;

export const conversationTitleSchema = z.string().trim().min(1).max(200);

export const renameInputSchema = z.strictObject({
  title: conversationTitleSchema,
});
export type RenameInput = z.infer<typeof renameInputSchema>;

export const conversationMetadataSchema = z.strictObject({
  id: conversationIdSchema,
  title: conversationTitleSchema,
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

export type Conversation = {
  conversation: ConversationMetadata;
  messages: UIMessage[];
  pendingTurn: PendingTurn | null;
};

export const conversationListSchema = z.strictObject({
  conversations: z.array(conversationMetadataSchema),
});
export type ConversationList = z.infer<typeof conversationListSchema>;
