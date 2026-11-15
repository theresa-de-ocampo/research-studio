import "server-only";

export class ConversationLockError extends Error {
  constructor(options?: ErrorOptions) {
    super("Conversation locking is unavailable.", options);
    this.name = "ConversationLockError";
  }
}

export function toConversationLockError(cause: unknown): ConversationLockError {
  let error: ConversationLockError;
  if (cause instanceof ConversationLockError) {
    error = cause;
  } else {
    error = new ConversationLockError({ cause });
  }
  return error;
}
