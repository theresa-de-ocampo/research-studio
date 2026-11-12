import type { ChatError, ChatErrorCode } from "../../types/chat";
import { CHAT_ERROR_MESSAGES } from "../constants/chat";

// Deliberately accepts no exception, provider payload, or database details.
export function createChatError(code: ChatErrorCode): ChatError {
  return { error: { code, message: CHAT_ERROR_MESSAGES[code] } };
}
