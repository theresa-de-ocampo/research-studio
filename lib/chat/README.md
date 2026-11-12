# Application chat contracts

Import application-specific contracts from `lib/chat` on either side of the server/client boundary. Import SDK-owned types such as `UIMessage` and `TextUIPart` directly from `ai`; this module does not redefine or re-export them. These modules do not import database clients, configuration, or Node APIs.

## API boundaries

- Parse route IDs with `conversationIdSchema` (UUIDs normalize to lowercase).
- Parse rename bodies with `renameInputSchema`. Both rename input and conversation metadata use `conversationTitleSchema`: titles are trimmed, non-empty, and at most 200 characters. Initial-title generation must follow the same rule.
- Parse message submissions with `submitMessageInputSchema`. The entire body is `{ id, role: "user", parts: [{ type: "text", text }] }`, without a `message` wrapper. Preserve the stable user ID when retrying. Use `DefaultChatTransport.prepareSendMessagesRequest` to send this shape instead of its default transcript payload, projecting submitted parts to `type` and `text`.
- IDs accept 1–128 ASCII letters, numbers, underscores, or hyphens, including SDK IDs and UUIDs. Submitted text must contain non-whitespace content across its parts; its original formatting is preserved.
- Request objects are strict. Arrays of messages, extra fields, system/assistant submissions, metadata, files, tools, and unsupported parts are rejected. Submitted parts cannot set streaming state. This is the application's request policy, not a replacement schema for SDK messages.
- Metadata uses JSON ISO timestamps, with `updatedAt: null` on creation. Collection responses wrap `conversations`; creation returns `ConversationMetadata`. `Conversation` describes the application response containing `conversation`, SDK `UIMessage[]`, and `pendingTurn`.
- For runtime validation of loaded SDK messages, use `validateUIMessages` from `ai`. Validate the application metadata and pending-turn fields with their respective Zod schemas. There is no duplicate SDK message schema or combined detail-response schema here; the `Conversation` type alone does not validate incoming JSON. SDK message validation does not replace the narrower message-submission policy.

## Identity and recovery

Use the SDK's `UIMessage` directly for `useChat`, stream wrappers, and checkpoint-to-UI conversion. Application-specific `SubmitMessageInput` describes only the validated submission, not general loaded or streamed messages. LangGraph remains the owner of persisted history; convert its messages into SDK messages at the UI boundary.

Persisted user IDs remain unchanged. Before model execution, derive the assistant ID with `getAssistantMessageId(userMessageId)` and use that exact ID for the graph's assistant message, the UI response wrapper's message start, and reload conversion. Never substitute a provider-generated ID or invent a new ID when loading history. The reserved `assistant:` prefix prevents collisions with accepted user IDs and keeps retries deterministic. This format is the application's identity convention, not an SDK requirement.

`pendingTurn: null` means there is no unfinished graph turn. Otherwise it carries the original user ID and its canonical assistant ID; reconcile persisted state before retrying. Partial streamed text remains provisional until graph execution and synchronous checkpoint writes finish. A pending turn does not itself indicate whether another request currently holds the conversation lock; overlapping mutations return `busy`.

## Public errors

Use `createChatError(code)` and `CHAT_ERROR_STATUS[code]` for JSON failures. The helper accepts only the public code, never an exception or Zod issue payload. Streaming code can use the same fixed public message when a response has already started. Do not send driver errors, provider errors, request input, or environment values to clients.

## Human verification

Inspect the schemas and manually try a valid text body, whitespace-only text, an invalid UUID, a file/tool part, and a full `messages` transcript. Only the supported newest-user-message body should parse. Compare assistant IDs from persistence, response start, and reload when the later graph/stream cards are implemented. No endpoints or automated tests are added here.
