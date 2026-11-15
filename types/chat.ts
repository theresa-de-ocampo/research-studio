import type { UIMessage } from "ai";
import type { z } from "zod";

import type {
  chatErrorCodeSchema,
  chatErrorSchema,
  conversationListSchema,
  conversationMetadataSchema,
  pendingTurnSchema,
  renameInputSchema,
  submitMessageInputSchema,
} from "../lib/schemas/chat";

export type SubmitMessageInput = z.infer<typeof submitMessageInputSchema>;
export type RenameInput = z.infer<typeof renameInputSchema>;
export type ConversationMetadata = z.infer<typeof conversationMetadataSchema>;
export type PendingTurn = z.infer<typeof pendingTurnSchema>;
export type ConversationList = z.infer<typeof conversationListSchema>;
export type ChatErrorCode = z.infer<typeof chatErrorCodeSchema>;
export type ChatError = z.infer<typeof chatErrorSchema>;

export type Conversation = {
  conversation: ConversationMetadata;
  messages: UIMessage[];
  pendingTurn: PendingTurn | null;
};
