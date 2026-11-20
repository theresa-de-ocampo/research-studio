"use server";

import { refresh } from "next/cache";

import { createChatError } from "@/lib/chat/errors";
import { conversationMetadataSchema } from "@/lib/schemas/chat";
import { getRuntimeDatabase } from "@/lib/server/db/database";
import { conversations } from "@/lib/server/db/tables";
import type { ChatError, ConversationMetadata } from "@/types/chat";

export async function createConversation(): Promise<ConversationMetadata | ChatError> {
  let result: ConversationMetadata | ChatError;

  try {
    // PostgreSQL supplies the UUID and creation time; updatedAt stays null.
    const [row] = await getRuntimeDatabase()
      .insert(conversations)
      .values({ title: "New chat" })
      .returning();

    result = conversationMetadataSchema.parse(row);
  } catch {
    result = createChatError("database");
  }

  // Keep framework refresh work outside the storage error handler.
  if (!("error" in result)) {
    refresh();
  }

  return result;
}
