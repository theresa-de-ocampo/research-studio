"use server";

import { refresh } from "next/cache";

import { createChatError } from "@/lib/chat/errors";
import { createConversation as insertConversation } from "@/lib/server/conversations/metadata";
import type { ChatError, ConversationMetadata } from "@/types/chat";

export async function createConversation(): Promise<ConversationMetadata | ChatError> {
  let result: ConversationMetadata | ChatError;

  try {
    result = await insertConversation();
  } catch {
    result = createChatError("database");
  }

  // Keep framework refresh work outside the storage error handler.
  if (!("error" in result)) {
    refresh();
  }

  return result;
}
