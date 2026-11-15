import "server-only";

/** Identifies failures in conversation-lock connection and query handling. */
export class ConversationLockError extends Error {
  constructor(options?: ErrorOptions) {
    super("Conversation locking is unavailable.", options);
    this.name = "ConversationLockError";
  }
}

/** Wraps a failure while preserving an existing conversation-lock error. */
export function toConversationLockError(cause: unknown): ConversationLockError {
  let error: ConversationLockError;
  if (cause instanceof ConversationLockError) {
    error = cause;
  } else {
    error = new ConversationLockError({ cause });
  }
  return error;
}
