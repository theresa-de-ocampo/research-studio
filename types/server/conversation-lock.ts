import type { PoolClient } from "pg";

// Shared by operation orchestration, cleanup, and connection-error handling.
export type ConversationLockState = {
  client: PoolClient | undefined;
  acquired: boolean;
  discardClient: boolean;
  connectionFailed: boolean;
};
