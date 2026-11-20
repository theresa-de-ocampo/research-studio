# Code structure

Folders describe responsibilities; filenames describe subjects. Use direct
imports such as `@/lib/schemas/chat`, `@/lib/conversations/getter`, and
`@/lib/actions/conversation`. Use `import type` when importing types.
The existing `@/*` alias points to the repository root.

## Where code belongs

| Location                         | Responsibility                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `app/`                           | Next.js routes, layouts, and route-specific UI.                                                  |
| `lib/schemas/`                   | Pure runtime validation contracts grouped by subject.                                            |
| `types/`                         | Reusable application-owned types, grouped by subject.                                            |
| `lib/constants/`                 | Shared fixed values, enum-like values, and lookup maps.                                          |
| `lib/chat/`                      | Chat behavior usable by both server and client code.                                             |
| `lib/actions/`                   | Server Actions implementing UI mutations, sanitized errors, and refresh after success.           |
| `lib/server/<feature>/getter.ts` | Server-only feature reads called directly by Server Components or other server code.             |
| `lib/server/`                    | Server infrastructure, environment readers, database clients, locking, and model/turn execution. |
| `scripts/`                       | Executable tooling and tooling-specific behavior.                                                |
| `drizzle/`                       | Reviewed migration SQL and generated migration metadata.                                         |
| `docs/`                          | Goal implementation notes, operational guides, and code navigation.                              |

Keep conversation creation directly in `lib/actions/conversation.ts` and listing
in `lib/server/conversations/getter.ts`. Do not add a separate mutation repository or
conversion helper for a single action's insert. Shared infrastructure such as the
database client and conversation lock stays in `lib/server/`. Streaming and
checkpoint writes remain part of server-side turn execution.

Keep types, constants, and helpers used by only one implementation beside that
implementation. `ConversationLockResult` stays in
`lib/server/conversations/lock/index.ts`; `RuntimeDatabase` stays in
`lib/server/db/database.ts`. The connection checkout timeout stays in
`lock/get-db-connection.ts`. The query timeout shared by acquisition and unlocking
lives in `lib/constants/conversation-lock.ts`. Connection ownership and failure
flags remain local to the lock orchestrator; helpers receive specific inputs
instead of sharing a mutable state object.

Infer reusable schema-backed types in `types/chat.ts`; do not duplicate their
shapes. Import SDK-owned types such as `UIMessage` directly from their packages.
Private schema fragments and validation predicates stay with their parent schema.

## Dependencies and server boundaries

- Schema modules may import other pure schemas and constants. They must not read
  environment variables, initialize clients, or import server-only modules.
- Shared constants have no dependency on application schemas or types. Types
  reference schemas through type-only imports, avoiding runtime dependency cycles.
- Shared chat helpers consume schemas and constants. Schemas must not import
  helpers that consume those schemas. Pending-turn validation and message-ID
  creation share the assistant prefix constant directly.
- Keep `server-only` protection on feature getters, environment readers, database
  clients, and conversation mutation locking. Reading environment values and
  initializing clients remain lazy; module imports must not require credentials
  or connections.
- Feature getters have no `"use server"` directive and contain read operations
  only. Server Components establish request-time boundaries before calling them.
  Do not globally cache conversation metadata or transcripts.
- Server Action modules use a top-level `"use server"` directive and export only
  async action functions as runtime values. Implement the UI mutation directly in
  the action, validate inputs and returned metadata, and return sanitized errors.
  Keep framework refresh work outside storage error handlers and refresh only
  after successful mutations.
- Metadata date schemas use `z.date()`, with `z.date().nullable()` for nullable
  activity timestamps. Parse database rows directly: Drizzle supplies `Date`
  instances and React preserves them across action results and component props.
  Do not add ISO conversion helpers for these boundaries. JSON date strings are
  a different representation and do not satisfy the metadata schema.
- `lib/server/db/tables.ts` contains Drizzle source definitions, with no runtime
  client or environment imports. Drizzle tooling can load it independently.
- Tooling may reuse application schemas and server helpers. Application modules
  must not import `scripts/`. Migration credential selection and database-target
  comparison stay in `scripts/db/migration-environment.ts`.

## Naming and growth

Use feature-scoped `getter.ts` files for reads and singular subject names for
Server Action modules, such as `lib/actions/conversation.ts`. Other implementation
files use short subject-based names such as `chat.ts`, `environment.ts`, and
`acquire-lock.ts`. Avoid generic `contracts.ts`, `runtime.ts`, or `utils.ts`
files and catch-all barrel exports. Several small files with one responsibility
can be combined when they cover the same subject, as with environment readers.

There is currently no `lib/config/`. Keep implementation-specific timeout settings
local; put values shared by multiple modules in `lib/constants/`.
Introduce new folders only when actual code needs them. If shared UI components
are added, use `components/`; keep route-specific components beside their routes.

The conversation lock uses four stage modules under `lib/server/conversations/lock/`:
`index.ts` owns the connection lifecycle and coordinates `get-db-connection.ts`,
`acquire-lock.ts`, and `release-lock.ts`. Unlocking is separate from returning or
destroying a pool connection, which remains the orchestrator's responsibility.
The entry point contains implementation rather than catch-all barrel exports.
Helpers import shared errors from `lib/server/conversations/lock/lock-error.ts` and
must not import the entry point. See [G09](G09.md) for the module responsibilities.

## Documentation

Keep the root [README](../README.md) as a short entry point and
[PLAN.md](../PLAN.md) as the product and architecture overview. Put goal-specific
implementation notes in `docs/<goal-ID>.md`, without nested READMEs. Split notes
covering multiple goals into their corresponding files.

| Goal | Notes                                       |
| ---- | ------------------------------------------- |
| G03  | [Server environment configuration](G03.md)  |
| G04  | [Runtime database clients](G04.md)          |
| G05  | [Conversation metadata tables](G05.md)      |
| G06  | [Database roles and setup](G06.md)          |
| G08  | [Application chat contracts](G08.md)        |
| G09  | [Conversation mutation guard](G09.md)       |
| G10  | [Conversation creation and listing](G10.md) |

Database setup and role guidance are collected in [G06](G06.md).
Update imports, documentation links, and tooling source paths when moving files.
