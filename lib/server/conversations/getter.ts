import "server-only";

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { START } from "@langchain/langgraph";
import type { UIMessage } from "ai";
import { desc, eq, sql } from "drizzle-orm";

import { createChatError } from "@/lib/chat/errors";
import { getAssistantMessageId } from "@/lib/chat/message-ids";
import {
  conversationIdSchema,
  conversationListSchema,
  conversationMetadataSchema,
  pendingTurnSchema,
} from "@/lib/schemas/chat";
import {
  getConversationGraph,
  getConversationGraphConfig,
} from "@/lib/server/chat/graph";
import { getRuntimeDatabase } from "@/lib/server/db/database";
import { conversations } from "@/lib/server/db/tables";
import type { ChatError, Conversation, ConversationList } from "@/types/chat";

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

/** Call after the Server Component's request-time boundary or during turn reconciliation. */
export async function getConversation(conversationId: unknown): Promise<Conversation | ChatError> {
  const id = conversationIdSchema.safeParse(conversationId);
  let result: Conversation | ChatError;

  if (!id.success) {
    result = createChatError("validation");
  } else {
    try {
      const [row] = await getRuntimeDatabase()
        .select()
        .from(conversations)
        .where(eq(conversations.id, id.data))
        .limit(1);

      if (row === undefined) {
        result = createChatError("missing-conversation");
      } else {
        const conversation = conversationMetadataSchema.parse(row);
        const graph = getConversationGraph();
        const snapshot = await graph.getState(getConversationGraphConfig(conversation.id));
        const checkpointMessages: unknown = snapshot.values.messages;

        if (checkpointMessages !== undefined && !Array.isArray(checkpointMessages)) {
          throw new Error("Expected a checkpoint message array.");
        }

        const messages = (checkpointMessages ?? []).map(toUIMessage);
        const latestMessage = messages.at(-1);
        // getState can apply saved START writes before the model appears in next.
        const hasPendingWork = snapshot.next.length > 0 || snapshot.tasks.some(
          (task) => task.name === START && task.result !== undefined,
        );
        const pendingTurn = hasPendingWork && latestMessage?.role === "user"
          ? pendingTurnSchema.parse({
            userMessageId: latestMessage.id,
            assistantMessageId: getAssistantMessageId(latestMessage.id),
          })
          : null;

        result = { conversation, messages, pendingTurn };
      }
    } catch {
      result = createChatError("database");
    }
  }

  return result;
}

function toUIMessage(message: unknown): UIMessage {
  const isUser = HumanMessage.isInstance(message);

  if (!isUser && !AIMessage.isInstance(message)) {
    throw new Error("Unsupported checkpoint message role.");
  }

  if (typeof message.id !== "string" || message.id.length === 0) {
    throw new Error("Checkpoint message is missing its ID.");
  }

  const parts: UIMessage["parts"] = [];

  for (const block of message.contentBlocks) {
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    }
  }

  // OpenAI Responses keeps refusal text separate from the assistant's text blocks.
  const refusal = message.additional_kwargs?.refusal;
  if (!isUser && typeof refusal === "string" && refusal.length > 0) {
    parts.push({ type: "text", text: refusal });
  }

  return { id: message.id, role: isUser ? "user" : "assistant", parts };
}
