# Shared chat contracts

Import from `lib/chat` on either side of the server/client boundary. These modules use only Zod and erased AI SDK type imports; they do not import database clients, configuration, or Node APIs.

## API boundaries

- Parse route IDs with `conversationIdSchema` (UUIDs normalize to lowercase).
- Parse rename bodies with `renameInputSchema`; titles are trimmed, non-empty, and at most 200 characters.
- Parse turn bodies with `turnInputSchema`. The entire body is `{ message: { id, role: "user", parts: [{ type: "text", text }] } }`. Preserve the stable user ID when retrying. Configure the transport to send this shape instead of its default transcript payload.
- IDs accept 1–128 ASCII letters, numbers, underscores, or hyphens, including SDK IDs and UUIDs. Text must contain non-whitespace content across its parts; its original formatting is preserved.
- All objects are strict. Arrays of messages, extra fields, system/assistant submissions, metadata, files, tools, and unsupported parts are rejected. Submitted parts cannot set streaming state.
- Metadata uses JSON ISO timestamps, with `updatedAt: null` on creation. Collection responses wrap `conversations`; creation returns `ConversationMetadata`. Detail responses contain `conversation`, `messages`, and `pendingTurn`.

## Identity and recovery

`ChatMessage` narrows the installed AI SDK `UIMessage` to user/assistant text only. The same type is intended for `useChat`, stream wrappers, and checkpoint-to-UI conversion. Persisted user IDs remain unchanged. Before model execution, derive the assistant ID with `getAssistantMessageId(userMessageId)` and use that exact ID for the graph's assistant message, the UI response wrapper's message start, and reload conversion. Never substitute a provider-generated ID or invent a new ID when loading history. The reserved `assistant:` prefix prevents collisions with accepted user IDs and keeps retries deterministic.

`pendingTurn: null` means there is no unfinished graph turn. Otherwise it carries the original user ID and its canonical assistant ID; reconcile persisted state before retrying. Partial streamed text remains provisional until graph execution and synchronous checkpoint writes finish. A pending turn does not itself indicate whether another request currently holds the conversation lock; overlapping mutations return `busy`.

## Public errors

Use `createChatError(code)` and `CHAT_ERROR_STATUS[code]` for JSON failures. The helper accepts only the public code, never an exception or Zod issue payload. Streaming code can use the same fixed public message when a response has already started. Do not send driver errors, provider errors, request input, or environment values to clients.

## Human verification

Inspect the schemas and manually try a valid text body, whitespace-only text, an invalid UUID, a file/tool part, and a full `messages` transcript. Only the supported newest-user-message body should parse. Compare assistant IDs from persistence, response start, and reload when the later graph/stream cards are implemented. No endpoints or automated tests are added here.
