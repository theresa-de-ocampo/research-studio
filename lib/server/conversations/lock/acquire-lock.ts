import "server-only";

import type { PoolClient } from "pg";

import { LOCK_QUERY_TIMEOUT_MS } from "@/lib/constants/conversation-lock";

import { ConversationLockError, toConversationLockError } from "./lock-error";

export async function acquireLock(
  client: PoolClient,
  key: string
): Promise<boolean> {
  let acquired: boolean;

  try {
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
  } catch (error) {
    throw toConversationLockError(error);
  }

  return acquired;
}
