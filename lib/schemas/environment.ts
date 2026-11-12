import { z } from "zod";

import { databaseUrlSchema } from "./database";

export const runtimeDatabaseSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export const modelSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1),
});

export const migrationSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  MIGRATION_DATABASE_URL: databaseUrlSchema,
});
