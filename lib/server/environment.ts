import "server-only";

import type { z } from "zod";

import { modelSchema, runtimeDatabaseSchema } from "../schemas/environment";

export function validateConfig<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const variables = new Set(
      result.error.issues.map((issue) => String(issue.path[0])),
    );

    // Never propagate validation details or causes that could contain secrets.
    throw new Error(
      `Invalid server configuration: check ${[...variables].join(", ")}.`,
    );
  }

  return result.data;
}

export function readRuntimeDatabaseConfig() {
  const config = validateConfig(runtimeDatabaseSchema, {
    DATABASE_URL: process.env.DATABASE_URL,
  });

  return { databaseUrl: config.DATABASE_URL };
}

export function readModelConfig() {
  const config = validateConfig(modelSchema, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });

  return { apiKey: config.OPENAI_API_KEY, model: config.OPENAI_MODEL };
}
