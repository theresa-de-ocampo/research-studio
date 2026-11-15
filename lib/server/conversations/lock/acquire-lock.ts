import "server-only";

import type { PoolClient } from "pg";

import { LOCK_QUERY_TIMEOUT_MS } from "@/lib/constants/conversation-lock";
import type { ConversationLockState } from "@/types/server/conversation-lock";

import { ConversationLockError, toConversationLockError } from "./lock-error";

export async function acquireLock(
  client: PoolClient,
  key: string,
  state: ConversationLockState
): Promise<void> {
  try {
    // If the query fails, the server may still have acquired the session lock.
    state.discardClient = true;
    const lockQuery = {
      text: "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
      values: [key],
      query_timeout: LOCK_QUERY_TIMEOUT_MS
    };
    const lock = await client.query<{ acquired: boolean }>(lockQuery);
    if (typeof lock.rows[0]?.acquired !== "boolean") {
      throw new ConversationLockError();
    }
    state.acquired = lock.rows[0].acquired;
    state.discardClient = state.connectionFailed;
  } catch (error) {
    throw toConversationLockError(error);
  }
}
