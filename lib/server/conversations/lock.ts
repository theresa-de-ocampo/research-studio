import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";

import { getRuntimePool } from "../db/pool";

const conversationUuidSchema = z.uuid();
const CONNECTION_TIMEOUT_MS = 5_000;
const LOCK_QUERY_TIMEOUT_MS = 5_000;

export type ConversationLockResult<T> =
  | { status: "busy" }
  | { status: "completed"; value: T };

export class ConversationLockError extends Error {
  constructor(options?: ErrorOptions) {
    super("Conversation locking is unavailable.", options);
    this.name = "ConversationLockError";
  }
}

function toConversationLockError(cause: unknown): ConversationLockError {
  let error: ConversationLockError;
  if (cause instanceof ConversationLockError) {
    error = cause;
  } else {
    error = new ConversationLockError({ cause });
  }
  return error;
}

export function getConversationLockKey(conversationId: string): string {
  const uuid = conversationUuidSchema.parse(conversationId).toLowerCase();
  const digest = createHash("sha256")
    .update(`research-studio:conversation:${uuid}`)
    .digest();

  // Send a decimal bigint string: a JS number would lose 64-bit precision.
  return digest.readBigInt64BE(0).toString();
}

function checkoutLockClient(signal: AbortSignal): Promise<PoolClient> {
  const pool = getRuntimePool();

  return new Promise((resolve, reject) => {
    let settled = false;

    function cleanup() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }

    function onAbort() {
      if (!settled) {
        settled = true;
        cleanup();
        reject(signal.reason);
      }
    }

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new ConversationLockError());
      }
    }, CONNECTION_TIMEOUT_MS);

    signal.addEventListener("abort", onAbort, { once: true });

    if (signal.aborted) {
      onAbort();
    } else {
      void pool.connect().then(
        (client) => {
          if (settled) {
            // A cancelled/timed-out checkout must not leak a late connection.
            client.release();
          } else {
            settled = true;
            cleanup();
            resolve(client);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(toConversationLockError(error));
          }
        }
      );
    }
  });
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
    client = await checkoutLockClient(controller.signal);
    client.on("error", onConnectionError);
    controller.signal.throwIfAborted();

    try {
      // If the query fails, the server may still have acquired the session lock.
      discardClient = true;
      const lockQuery = {
        text: "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
        values: [key],
        query_timeout: LOCK_QUERY_TIMEOUT_MS
      };
      const lock = await client.query<{ acquired: boolean }>(lockQuery);
      if (typeof lock.rows[0]?.acquired !== "boolean") {
        throw new ConversationLockError();
      }
      acquired = lock.rows[0].acquired;
      discardClient = connectionFailed;
    } catch (error) {
      throw toConversationLockError(error);
    }

    controller.signal.throwIfAborted();
    if (acquired) {
      const value = await operation(controller.signal);
      controller.signal.throwIfAborted();
      result = { status: "completed", value };
    }
  } catch (error) {
    // Log error now, errors thrown in finally block overwrites the original exception
    console.error("Conversation operation failed.", { conversationId }, error);
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    if (client) {
      try {
        if (acquired && !connectionFailed) {
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
        // Log error now, errors thrown in finally block overwrites the original exception
        console.error("Conversation unlock failed.", { conversationId }, error);
        discardClient = true;
        throw toConversationLockError(error);
      } finally {
        // Never return a possibly locked or broken session to the shared pool.
        client.release(discardClient);
        client.removeListener("error", onConnectionError);
      }
    }
  }

  return result;
}
