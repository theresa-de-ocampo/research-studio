import "server-only";

import { desc, sql } from "drizzle-orm";

import { createChatError } from "@/lib/chat/errors";
import { conversationMetadataSchema } from "@/lib/schemas/chat";
import { getRuntimeDatabase } from "@/lib/server/db/database";
import { conversations } from "@/lib/server/db/tables";
import type {
  ChatError,
  ConversationList,
  ConversationMetadata,
} from "@/types/chat";

function toMetadata(
  row: typeof conversations.$inferSelect,
): ConversationMetadata {
  return conversationMetadataSchema.parse({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  });
}

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

    result = { conversations: rows.map(toMetadata) };
  } catch {
    result = createChatError("database");
  }

  return result;
}

export async function createConversation(): Promise<ConversationMetadata> {
  // PostgreSQL supplies the UUID and creation time; updatedAt stays null.
  const [row] = await getRuntimeDatabase()
    .insert(conversations)
    .values({ title: "New chat" })
    .returning();

  if (!row) {
    throw new Error("Conversation creation returned no metadata.");
  }

  return toMetadata(row);
}
