import "server-only";

import { Pool } from "pg";

import { readRuntimeDatabaseConfig } from "../config/runtime";

const runtimeGlobal = globalThis as typeof globalThis & {
  researchStudioRuntimePool?: Pool;
};

export function getRuntimePool(): Pool {
  if (!runtimeGlobal.researchStudioRuntimePool) {
    const { databaseUrl } = readRuntimeDatabaseConfig();
    const pool = new Pool({ connectionString: databaseUrl });

    // Handle idle-client failures without logging credentials or driver details.
    pool.on("error", () => {
      console.error("An idle runtime database connection failed.");
    });

    // Keep the same pool when Next.js reloads server modules in development.
    runtimeGlobal.researchStudioRuntimePool = pool;
  }

  return runtimeGlobal.researchStudioRuntimePool;
}
