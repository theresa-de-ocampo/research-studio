import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { getRuntimePool } from "./pool";

type RuntimeDatabase = NodePgDatabase & { $client: Pool };

let database: RuntimeDatabase | undefined;

export function getRuntimeDatabase(): RuntimeDatabase {
  if (!database) {
    database = drizzle({ client: getRuntimePool() });
  }

  return database;
}
