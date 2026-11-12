import "server-only";

import { migrationSchema } from "../../lib/schemas/environment";
import { getDatabaseTarget } from "../../lib/server/db/database-target";
import { validateConfig } from "../../lib/server/environment";

export function readMigrationConfig() {
  const config = validateConfig(migrationSchema, {
    DATABASE_URL: process.env.DATABASE_URL,
    MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
  });
  const runtime = getDatabaseTarget(config.DATABASE_URL);
  const migration = getDatabaseTarget(config.MIGRATION_DATABASE_URL);

  if (
    runtime.host !== migration.host ||
    runtime.port !== migration.port ||
    runtime.database !== migration.database
  ) {
    throw new Error(
      "Invalid server configuration: DATABASE_URL and MIGRATION_DATABASE_URL must target the same host, port, and database.",
    );
  }

  // Runtime credentials are used only for comparison, never for migration access.
  return { databaseUrl: config.MIGRATION_DATABASE_URL };
}
