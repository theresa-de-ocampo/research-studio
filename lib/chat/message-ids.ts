import { ASSISTANT_MESSAGE_PREFIX } from "../constants/chat";
import { userMessageIdSchema } from "../schemas/chat";

export function getAssistantMessageId(userMessageId: string): string {
  return `${ASSISTANT_MESSAGE_PREFIX}${userMessageIdSchema.parse(userMessageId)}`;
}
