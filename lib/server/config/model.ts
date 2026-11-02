import "server-only";

import { z } from "zod";

import { validateConfig } from "./validation";

const modelSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1),
});

export function readModelConfig() {
  const config = validateConfig(modelSchema, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });

  return { apiKey: config.OPENAI_API_KEY, model: config.OPENAI_MODEL };
}
