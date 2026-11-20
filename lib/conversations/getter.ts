import "server-only";

import { desc, sql } from "drizzle-orm";

import { createChatError } from "@/lib/chat/errors";
import { conversationListSchema } from "@/lib/schemas/chat";
import { getRuntimeDatabase } from "@/lib/server/db/database";
import { conversations } from "@/lib/server/db/tables";
import type { ChatError, ConversationList } from "@/types/chat";

/** Call from a request-time Server Component, without caching the result. */
export async function listConversations(): Promise<ConversationList | ChatError> {
  let result: ConversationList | ChatError;

  try {
    const rows = await getRuntimeDatabase()
      .select()
      .from(conversations)
      .orderBy(
        desc(sql`coalesce(${conversations.updatedAt}, ${conversations.createdAt})`),
        desc(conversations.id),
      );

    result = conversationListSchema.parse({ conversations: rows });
  } catch {
    result = createChatError("database");
  }

  return result;
}
