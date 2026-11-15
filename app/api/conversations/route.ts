import { connection } from "next/server";

import { createChatError } from "@/lib/chat/errors";
import { CHAT_ERROR_STATUS } from "@/lib/constants/chat";
import {
  createConversation,
  listConversations,
} from "@/lib/server/conversations/metadata";
import type { ConversationList } from "@/types/chat";

const responseHeaders = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  // Keep this outside the catch so Next.js can defer prerendering.
  await connection();

  let response: Response;

  try {
    const body: ConversationList = {
      conversations: await listConversations(),
    };
    response = Response.json(body, { headers: responseHeaders });
  } catch {
    response = Response.json(createChatError("database"), {
      status: CHAT_ERROR_STATUS.database,
      headers: responseHeaders,
    });
  }

  return response;
}

export async function POST(): Promise<Response> {
  let response: Response;

  try {
    const conversation = await createConversation();
    response = Response.json(conversation, {
      status: 201,
      headers: responseHeaders,
    });
  } catch {
    response = Response.json(createChatError("database"), {
      status: CHAT_ERROR_STATUS.database,
      headers: responseHeaders,
    });
  }

  return response;
}
