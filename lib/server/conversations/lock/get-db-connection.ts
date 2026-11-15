import "server-only";

import type { PoolClient } from "pg";

import { getRuntimePool } from "../../db/pool";
import { ConversationLockError, toConversationLockError } from "./lock-error";

const CONNECTION_TIMEOUT_MS = 5_000;

export function getDbConnection(signal: AbortSignal): Promise<PoolClient> {
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
