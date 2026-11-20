# Persistent chat app — project overview

## How to use this overview

This file describes the intended application architecture and v1 scope. It is a reference for agents, not an instruction to implement the entire project or execute the sections in order. Implement only the goal explicitly assigned by the human in the current request.

`AGENTS.md` governs coding conventions and execution boundaries. Follow [code structure](docs/code-structure.md) for file placement.

Development will primarily use Codex Cloud, with occasional local Codex sessions. Keep implementation portable between those environments. The app itself remains a personal application intended to run locally.

## 1. Summary and architecture

Build a personal TypeScript chat app with streamed OpenAI responses and conversation history that survives application and database restarts.

| Responsibility                         | Technology                                     |
| -------------------------------------- | ---------------------------------------------- |
| Application                            | Existing Next.js App Router                    |
| Frontend chat state and transport      | Vercel AI SDK UI                               |
| Components                             | shadcn/ui and its current AI Elements patterns |
| Streaming Markdown                     | Streamdown                                     |
| Model execution and conversation state | LangChain / LangGraph                          |
| Durable checkpoints                    | PostgresSaver                                  |
| Conversation metadata and migrations   | Drizzle                                        |
| Local database                         | Existing PostgreSQL 17 installation            |

The application configuration uses `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL`. Local development uses `.env.local`. Do not assume that this file, its values, or the local PostgreSQL server are available in Codex Cloud. Cloud sessions use configuration supplied by the human through the environment’s supported configuration mechanism. Keep secrets server-side and out of version control, logs, and client bundles. Missing or invalid required configuration is a stop condition under `AGENTS.md`.

The app serves one user on localhost without authentication. Tools, attachments, message editing, branching, cross-conversation memory, and public deployment are outside v1.

## 2. Database, roles, and migrations

**Separate runtime and migration access**

- `DATABASE_URL` authenticates as `app_service`. The running application uses this URL exclusively.
- `MIGRATION_DATABASE_URL` authenticates as `app_migrator`. Only migration and checkpoint-setup tooling uses it.
- Both URLs must target the same database.
- Runtime configuration readers live in `lib/server/environment.ts`; migration-only configuration and database-target comparison live in `scripts/db/migration-environment.ts`. Pure validation schemas live in `lib/schemas/environment.ts` and `lib/schemas/database.ts`. Runtime initialization must never fall back to migration credentials, and application modules must not import `scripts/`.
- Create one reusable runtime `pg.Pool` in `lib/server/db/pool.ts` and pass it to both Drizzle (`lib/server/db/database.ts`) and PostgresSaver (`lib/server/db/checkpointer.ts`). Keep configuration reads and client initialization lazy. Migration tooling uses a separate temporary pool and closes it afterward.
- Local configuration may contain both URLs in `.env.local`. This separates database permissions; it does not isolate the migration credential from the Next.js process. Runtime initialization must not require migration credentials.

**Permissions and ownership**

- `app_migrator` owns application and checkpoint objects and can create the required schemas, tables, and indexes. It does not need superuser privileges.
- `app_service` receives database connection permission, schema usage, and `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the four runtime data tables below.
- The service role owns no application objects, receives no schema-creation privileges, and has no membership in the migrator role.
- Migration journals remain accessible only to migration tooling.
- Role provisioning, ownership, and grants are human-managed prerequisites. If implementation requires changes to database objects, roles, or permissions, stop as specified in `AGENTS.md`. Normal app execution must not require administrator credentials.
- Runtime grants must cover any new runtime tables introduced by human-applied migrations.

PostgreSQL ownership controls the ability to alter or drop objects, so ownership stays with the migrator. [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html)

**Tables**

| Table                             | Managed by    | Runtime access    |
| --------------------------------- | ------------- | ----------------- |
| `public.conversations`            | Drizzle       | Read/write/delete |
| `langgraph.checkpoints`           | PostgresSaver | Read/write/delete |
| `langgraph.checkpoint_blobs`      | PostgresSaver | Read/write/delete |
| `langgraph.checkpoint_writes`     | PostgresSaver | Read/write/delete |
| `langgraph.checkpoint_migrations` | PostgresSaver | None              |
| `drizzle.__drizzle_migrations`    | Drizzle       | None              |

Define `public.conversations` in `lib/server/db/tables.ts` with UUID `id`, non-null `title`, non-null timezone-aware `created_at` defaulting to creation time, and nullable timezone-aware `updated_at` with no default. Leave `updated_at` null on creation and set it explicitly on subsequent activity. Index and list by `coalesce(updated_at, created_at) DESC, id DESC` so new and updated conversations share newest-activity ordering with a deterministic tie-breaker. Use its UUID as LangGraph’s `thread_id`.

Store messages only in checkpoint state; do not create a duplicate messages table. Retrieve transcripts through `graph.getState()`.

**Database setup design**

Drizzle owns conversation metadata migrations; PostgresSaver owns its checkpoint schema. Setup uses `MIGRATION_DATABASE_URL` for Drizzle migrations and `PostgresSaver.setup()` with the `langgraph` schema and must preserve existing conversations.

The tooling includes `db:generate`, `db:migrate`, `db:checkpoint-setup`, and `db:setup`. Combined setup performs metadata migrations followed by checkpoint setup. Grants and default privileges remain separate human-managed operations; the commands do not modify them. See [database setup](docs/G06.md#human-invoked-database-setup) and [role provisioning](docs/G06.md#human-managed-database-roles-and-privileges). These are commands for human execution, not commands for an agent to execute from this overview. Any work on this tooling must be explicitly scoped and remain subject to `AGENTS.md`.

Database setup and migrations are explicit human-managed operations. Never run them inside chat requests or ordinary app startup. Do not create a substitute database or start Docker to bypass unavailable infrastructure. [Drizzle migration workflow](https://orm.drizzle.team/docs/drizzle-kit-migrate)

## 3. Backend, streaming, and interfaces

**Graph and model**

- Keep database access, configuration, and model execution in server-only modules using the default Node.js runtime.
- Keep saved-conversation reads in `lib/conversations/getter.ts` and UI metadata mutations directly in `lib/actions/conversation.ts`; keep model execution in `lib/server/chat/graph.ts` and turn execution/recovery in `lib/server/chat/turns.ts`.
- Build a typed graph using `StateSchema` and `MessagesValue`: `START → callModel → END`.
- Use `ChatOpenAI` with the Responses API and `store: false`.
- Read the model from `OPENAI_MODEL`; do not hard-code a model or require a frontend picker.
- Append only the new user message. LangGraph restores prior context using the conversation ID.
- Use synchronous checkpoint durability and finish the response only after graph execution and checkpoint writes succeed.
- Preserve the full transcript. Automatic summarization is deferred; context-limit errors must leave history intact.

**AI SDK integration**

- Use `useChat` and `DefaultChatTransport` on the frontend.
- Send the latest user message and its stable ID instead of resubmitting the full transcript.
- Convert LangGraph streams through `@ai-sdk/langchain` into the standard AI SDK UI message stream.
- Import SDK-owned `UIMessage` directly from `ai` for streamed and loaded messages; use the SDK validator when runtime message validation is needed. Keep application Zod schemas in `lib/schemas/chat.ts`, schema-inferred application types in `types/chat.ts`, fixed error/identity values in `lib/constants/chat.ts`, and browser-safe identity/error helpers in `lib/chat/`.
- Preserve canonical message IDs across checkpoints, streaming, and reloads.
- Let the response wrapper control message start/finish boundaries.
- Keep transcript persistence in LangGraph. After completion, cancellation, or failure settles, refresh server-rendered metadata/history and reconcile the selected conversation's client messages and pending-turn state without stale refreshes overwriting another conversation or an active turn.

The official adapter supports converting LangGraph streams for AI SDK UI. [Adapter documentation](https://ai-sdk.dev/providers/adapters/langchain)

**Server reads, actions, and streaming**

| Behavior                                                  | Boundary                                                              | Location                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| List metadata by newest activity                          | Direct server-only read from Server Components                        | `lib/conversations/getter.ts`         |
| Create a conversation with a “New chat” placeholder title | Server Action                                                         | `lib/actions/conversation.ts`                 |
| Load metadata, UI messages, and pending-turn state        | Direct server-only read for Server Components and turn reconciliation | `lib/conversations/getter.ts`          |
| Rename                                                    | Server Action                                                         | `lib/actions/conversation.ts`                 |
| Delete checkpoints, then metadata                         | Server Action                                                         | `lib/actions/conversation.ts`                 |
| Submit or retry a turn and stream the response            | `POST /api/conversations/[id]/messages`                               | `app/api/conversations/[id]/messages/route.ts` |

Server Components call readers directly. All Server Actions live in `lib/actions/`, use module-level `'use server'`, and export only async action functions as runtime values. Validate inputs, implement the UI mutation directly in its action using shared server-only infrastructure, return serializable data or sanitized errors, and refresh server-rendered data after successful mutations. Metadata timestamps use `Date` instances validated by `z.date()`; parse database rows directly without date-conversion helpers. The messages Route Handler is the sole application API endpoint; it delegates to the turn runner, maps shared errors to HTTP status responses before streaming, and reports later failures through the AI SDK stream protocol.

Follow the installed Next.js documentation, including asynchronous page/route parameters and Cache Components behavior. Keep conversation reads request-time through the calling Server Components; do not globally cache metadata or transcripts. Use the default Node.js runtime without a `runtime` route export.

**Recovery and concurrency**

- Use stable message IDs to prevent duplicate submissions and replies.
- Serialize mutations to an existing conversation using the guard in `lib/server/conversations/lock/index.ts`; rename, deletion, and turn execution use the same PostgreSQL advisory lock. Hold it until all writes, stream production, checkpoint completion, and cancellation cleanup settle; reject overlapping operations with a busy result.
- Stop aborts the active streaming request; propagate request cancellation to graph/model execution.
- Treat partial streamed assistant text as provisional; committed messages survive interruption.
- Retry unfinished turns through the same messages endpoint using the original user-message ID and pending graph work after reconciling persisted history. Stop and Retry require no additional endpoints.
- Do not expose regeneration of completed answers in v1.
- Make deletion retryable and report cleanup failures.
- Do not add background generation or a resumable token-stream service.

## 4. Frontend and dependencies

**Interface**

- Adapt the current shadcn Base UI Chat, Message, and Prompt Input patterns into project-owned components in `components/chat/`. Use the current shadcn patterns rather than the older AI Elements registry. [Component guidance](https://ui.shadcn.com/docs/ai-elements)
- Provide a desktop sidebar and mobile drawer with New chat, selection, rename, and confirmed deletion.
- Use `app/page.tsx` for `/` and `app/chat/[id]/page.tsx` for saved conversations at `/chat/[id]`. Create new conversations through the Server Action before navigation or streaming.
- Load the sidebar metadata and persisted history in Server Components before initializing each conversation’s chat instance. Pass serializable results to the interactive client components. Switching conversations cancels the previous request and isolates message state; cancellation must also handle route hiding, effect cleanup, and disposal.
- Use a centered transcript, user bubbles, assistant Markdown responses, and a multiline composer below the transcript.
- Use neutral styling, system light/dark appearance, and the existing Geist font.
- Render Markdown with Streamdown, including GFM tables, highlighted code, and copy controls; disable raw HTML.
- Include generation status, Stop, failed-turn Retry, and message copying.
- Enter sends; Shift+Enter adds a newline; respect input composition events.
- Follow streaming output only while the user remains at the live edge.
- Provide accessible keyboard controls and empty, loading, missing-conversation, database-error, and generation-error states.
- Derive the initial conversation title from the first message without an additional model call.
- Keep goal notes in `docs/<goal-ID>.md` and the operation runbook in `docs/G25.md`, linked from the short root README.

**Packages**

Keep the installed LangChain, LangGraph, OpenAI integration, PostgreSQL checkpointer, and Zod packages.

Potential runtime dependencies, subject to the installed package inventory and the assigned goal:

- `ai`, `@ai-sdk/react`, `@ai-sdk/langchain`
- `streamdown`, `@streamdown/code`
- `drizzle-orm`, `pg`, `server-only`
- Dependencies required by the selected shadcn components, including Base UI primitives, icons, scrolling, and styling utilities

Potential development dependencies for database tooling:

- `drizzle-kit`, `@types/pg`, `tsx`, `@next/env`

This package list describes the intended stack, not an installation instruction. Reuse installed dependencies where they satisfy the assigned goal. If a dependency must be installed, updated, or removed, stop and explain the required human action under `AGENTS.md`.
