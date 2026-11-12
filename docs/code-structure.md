# Code structure

Folders describe responsibilities; filenames describe subjects. Use direct
imports such as `@/lib/schemas/chat`, `@/lib/constants/chat`, and `@/types/chat`.
Use `import type` when importing types. The existing `@/*` alias points to the
repository root.

## Where code belongs

| Location | Responsibility |
| --- | --- |
| `app/` | Next.js routes, layouts, and route-specific UI. |
| `lib/schemas/` | Pure runtime validation contracts grouped by subject. |
| `types/` | Reusable application-owned types, grouped by subject. |
| `lib/constants/` | Shared fixed values, enum-like values, and lookup maps. |
| `lib/chat/` | Chat behavior usable by both server and client code. |
| `lib/server/` | Server-side behavior, including environment readers and database access. |
| `scripts/` | Executable tooling and tooling-specific behavior. |
| `drizzle/` | Reviewed migration SQL and generated migration metadata. |
| `docs/` | Goal implementation notes, operational guides, and code navigation. |

Keep types, constants, and helpers used by only one implementation beside that
implementation. Lock timeouts and `ConversationLockResult` stay in
`lib/server/conversations/mutation-lock.ts`; `RuntimeDatabase` stays in
`lib/server/db/database.ts`.

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
- Keep `server-only` protection on environment readers, database clients, and
  conversation mutation locking. Reading environment values and initializing
  clients remain lazy; module imports must not require credentials or connections.
- `lib/server/db/tables.ts` contains Drizzle source definitions, with no runtime
  client or environment imports. Drizzle tooling can load it independently.
- Tooling may reuse application schemas and server helpers. Application modules
  must not import `scripts/`. Migration credential selection and database-target
  comparison stay in `scripts/db/migration-environment.ts`.

## Naming and growth

Use short, subject-based filenames such as `chat.ts`, `environment.ts`, and
`mutation-lock.ts`. Avoid generic `contracts.ts`, `runtime.ts`, or `utils.ts`
files and catch-all barrel exports. Several small files with one responsibility
can be combined when they cover the same subject, as with environment readers.

There is currently no `lib/config/`. Keep lock-specific timeout settings local.
Introduce new folders only when actual code needs them. If shared UI components
are added, use `components/`; keep route-specific components beside their routes.

## Documentation

Keep the root [README](../README.md) as a short entry point and
[PLAN.md](../PLAN.md) as the product and architecture overview. Put goal-specific
implementation notes in `docs/<goal-ID>.md`, without nested READMEs. Split notes
covering multiple goals into their corresponding files.

| Goal | Notes |
| --- | --- |
| G03 | [Server environment configuration](G03.md) |
| G04 | [Runtime database clients](G04.md) |
| G05 | [Conversation metadata tables](G05.md) |
| G08 | [Application chat contracts](G08.md) |
| G09 | [Conversation mutation guard](G09.md) |

Keep the task-oriented [database setup](database-setup.md) and
[database roles](database-roles.md) guides under their descriptive filenames.
Update imports, documentation links, and tooling source paths when moving files.
