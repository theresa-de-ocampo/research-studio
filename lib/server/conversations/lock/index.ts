import "server-only";

import { createHash } from "node:crypto";

import { conversationIdSchema } from "@/lib/schemas/chat";
import type { ConversationLockState } from "@/types/server/conversation-lock";

import { toConversationLockError } from "./lock-error";
import { acquireLock } from "./acquire-lock";
import { cleanUp } from "./clean-up";
import { getDbConnection } from "./get-db-connection";

export type ConversationLockResult<T> =
  | { status: "busy" }
  | { status: "completed"; value: T };

function getConversationLockKey(conversationId: string): string {
  const uuid = conversationIdSchema.parse(conversationId);
  const digest = createHash("sha256")
    .update(`research-studio:conversation:${uuid}`)
    .digest();

  // Send a decimal bigint string: a JS number would lose 64-bit precision.
  return digest.readBigInt64BE(0).toString();
}

/**
 * The callback promise must cover ALL mutation, stream, and checkpoint work.
 * Do not resolve it with an unconsumed stream/Response or detached background work.
 * Cancellation is cooperative: await the operation's shutdown before releasing.
 */
export async function withConversationLock<T>(
  conversationId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal } = {}
): Promise<ConversationLockResult<T>> {
  const key = getConversationLockKey(conversationId);
  const controller = new AbortController();
  const cancel = () => {
    controller.abort(
      new DOMException(
        "The conversation operation was cancelled.",
        "AbortError"
      )
    );
  };

  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) {
    cancel();
  }

  const state: ConversationLockState = {
    client: undefined,
    acquired: false,
    discardClient: false,
    connectionFailed: false
  };
  let result: ConversationLockResult<T> = { status: "busy" };

  const onConnectionError = (error: Error) => {
    state.connectionFailed = true;
    state.discardClient = true;
    controller.abort(toConversationLockError(error));
  };

  try {
    controller.signal.throwIfAborted();
    const client = await getDbConnection(controller.signal);
    state.client = client;
    client.on("error", onConnectionError);
    controller.signal.throwIfAborted();

    // If acquisition fails, the connection may still hold the session lock.
    state.discardClient = true;
    state.acquired = await acquireLock(client, key);
    // Preserve any connection failure reported while acquisition was pending.
    state.discardClient = state.connectionFailed;

    controller.signal.throwIfAborted();
    if (state.acquired) {
      const value = await operation(controller.signal);
      controller.signal.throwIfAborted();
      result = { status: "completed", value };
    }
  } catch (error) {
    // Log before a cleanup error replaces the original operation error.
    console.error("Conversation operation failed.", { conversationId }, error);
    throw error;
  } finally {
    await cleanUp(state, {
      conversationId,
      key,
      signal: options.signal,
      cancel,
      onConnectionError
    });
  }

  return result;
}
