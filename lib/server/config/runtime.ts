import "server-only";

import { z } from "zod";

import { databaseUrlSchema } from "./database-url";
import { validateConfig } from "./validation";

const runtimeDatabaseSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export function readRuntimeDatabaseConfig() {
  const config = validateConfig(runtimeDatabaseSchema, {
    DATABASE_URL: process.env.DATABASE_URL,
  });

  return { databaseUrl: config.DATABASE_URL };
}
