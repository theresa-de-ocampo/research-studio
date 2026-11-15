import "server-only";

import { desc, sql } from "drizzle-orm";

import { conversationMetadataSchema } from "@/lib/schemas/chat";
import { getRuntimeDatabase } from "@/lib/server/db/database";
import { conversations } from "@/lib/server/db/tables";
import type { ConversationMetadata } from "@/types/chat";

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

export async function listConversations(): Promise<ConversationMetadata[]> {
  const rows = await getRuntimeDatabase()
    .select()
    .from(conversations)
    .orderBy(
      desc(sql`coalesce(${conversations.updatedAt}, ${conversations.createdAt})`),
      desc(conversations.id),
    );

  return rows.map(toMetadata);
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
