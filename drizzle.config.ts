import { defineConfig } from "drizzle-kit";

// Shared by offline generation and the human-invoked migration runner.
export const migrationOptions = {
  migrationsFolder: "./drizzle",
  migrationsSchema: "drizzle",
  migrationsTable: "__drizzle_migrations",
};

// Generation reads source only; credentials belong to scripts/db/migration-environment.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/db/tables.ts",
  out: migrationOptions.migrationsFolder,
  migrations: {
    schema: migrationOptions.migrationsSchema,
    table: migrationOptions.migrationsTable,
  },
});
