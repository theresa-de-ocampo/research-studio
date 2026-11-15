import "server-only";

import type { PoolClient } from "pg";

import { LOCK_QUERY_TIMEOUT_MS } from "@/lib/constants/conversation-lock";

import { ConversationLockError, toConversationLockError } from "./lock-error";

/** Unlocks on the owning connection; throws if release cannot be confirmed. */
export async function releaseLock(
  client: PoolClient,
  key: string
): Promise<void> {
  try {
    const unlockQuery = {
      text: "SELECT pg_advisory_unlock($1::bigint) AS released",
      values: [key],
      query_timeout: LOCK_QUERY_TIMEOUT_MS
    };
    const unlock = await client.query<{ released: boolean }>(unlockQuery);
    if (unlock.rows[0]?.released !== true) {
      throw new ConversationLockError();
    }
  } catch (error) {
    throw toConversationLockError(error);
  }
}
