export const ASSISTANT_MESSAGE_PREFIX = "assistant:";

export const CHAT_ERROR_CODES = [
  "validation",
  "missing-conversation",
  "busy",
  "database",
  "generation",
] as const;

export const CHAT_ERROR_STATUS = {
  validation: 400,
  "missing-conversation": 404,
  busy: 409,
  database: 503,
  generation: 502,
} as const satisfies Record<(typeof CHAT_ERROR_CODES)[number], number>;

export const CHAT_ERROR_MESSAGES = {
  validation: "The request is invalid.",
  "missing-conversation": "This conversation was not found.",
  busy: "This conversation is busy. Try again after the current operation finishes.",
  database: "Conversation storage is unavailable. Please try again.",
  generation: "The response could not be completed. Reload the conversation before retrying.",
} as const satisfies Record<(typeof CHAT_ERROR_CODES)[number], string>;
