import "server-only";

import { LOCK_QUERY_TIMEOUT_MS } from "@/lib/constants/conversation-lock";
import type { ConversationLockState } from "@/types/server/conversation-lock";

import { ConversationLockError, toConversationLockError } from "./lock-error";

type ConversationLockCleanupOptions = {
  conversationId: string;
  key: string;
  signal?: AbortSignal;
  cancel: () => void;
  onConnectionError: (error: Error) => void;
};

export async function cleanUp(
  state: ConversationLockState,
  options: ConversationLockCleanupOptions
): Promise<void> {
  const { client } = state;
  const { conversationId, key, signal, cancel, onConnectionError } = options;

  signal?.removeEventListener("abort", cancel);
  if (client) {
    try {
      if (state.acquired && !state.connectionFailed) {
        const unlockQuery = {
          text: "SELECT pg_advisory_unlock($1::bigint) AS released",
          values: [key],
          query_timeout: LOCK_QUERY_TIMEOUT_MS
        };
        const unlock = await client.query<{ released: boolean }>(unlockQuery);
        if (unlock.rows[0]?.released !== true) {
          throw new ConversationLockError();
        }
      }
    } catch (error) {
      // Log before a cleanup error replaces the original operation error.
      console.error("Conversation unlock failed.", { conversationId }, error);
      state.discardClient = true;
      throw toConversationLockError(error);
    } finally {
      // Read shared state after unlocking: a connection error may have changed it.
      // Never return a possibly locked or broken session to the shared pool.
      client.release(state.discardClient);
      client.removeListener("error", onConnectionError);
    }
  }
}
