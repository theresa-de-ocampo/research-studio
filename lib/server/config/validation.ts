import "server-only";

import { z } from "zod";

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
