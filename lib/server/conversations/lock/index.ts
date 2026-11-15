import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

import { conversationIdSchema } from "@/lib/schemas/chat";

import { toConversationLockError } from "./lock-error";
import { acquireLock } from "./acquire-lock";
import { getDbConnection } from "./get-db-connection";
import { releaseLock } from "./release-lock";

export type ConversationLockResult<T> =
  | { status: "busy" }
  | { status: "completed"; value: T };

/** Derives a stable advisory-lock key from a validated conversation UUID. */
function getConversationLockKey(conversationId: string): string {
  const uuid = conversationIdSchema.parse(conversationId);
  const digest = createHash("sha256")
    .update(`research-studio:conversation:${uuid}`)
    .digest();

  // Send a decimal bigint string: a JS number would lose 64-bit precision.
  return digest.readBigInt64BE(0).toString();
}

/**
 * Runs an operation under a conversation lock, or reports busy.
 * The callback must honor cancellation and await all mutations, streams, and checkpoints.
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

  let client: PoolClient | undefined;
  let acquired = false;
  let discardClient = false;
  let connectionFailed = false;
  let result: ConversationLockResult<T> = { status: "busy" };

  const onConnectionError = (error: Error) => {
    connectionFailed = true;
    discardClient = true;
    controller.abort(toConversationLockError(error));
  };

  try {
    controller.signal.throwIfAborted();
    client = await getDbConnection(controller.signal);
    client.on("error", onConnectionError);
    controller.signal.throwIfAborted();

    // If acquisition fails, the connection may still hold the session lock.
    discardClient = true;
    acquired = await acquireLock(client, key);
    // Preserve any connection failure reported while acquisition was pending.
    discardClient = connectionFailed;

    controller.signal.throwIfAborted();
    if (acquired) {
      const value = await operation(controller.signal);
      controller.signal.throwIfAborted();
      result = { status: "completed", value };
    }
  } catch (error) {
    // Log before a cleanup error replaces the original operation error.
    console.error("Conversation operation failed.", { conversationId }, error);
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    if (client) {
      try {
        if (acquired && !connectionFailed) {
          await releaseLock(client, key);
        }
      } catch (error) {
        // Log before a cleanup error replaces the original operation error.
        console.error("Conversation unlock failed.", { conversationId }, error);
        discardClient = true;
        throw error;
      } finally {
        // A connection error during unlocking must still destroy the connection.
        client.release(discardClient);
        client.removeListener("error", onConnectionError);
      }
    }
  }

  return result;
}
