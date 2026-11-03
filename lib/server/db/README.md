# Runtime database clients

Use these getters from server-only code in the Next.js Node.js runtime:

| Getter | Module | Purpose |
| --- | --- | --- |
| `getRuntimePool()` | `./pool` | Shared runtime `pg.Pool` for direct database access |
| `getRuntimeDatabase()` | `./drizzle` | Drizzle instance backed by that pool |
| `getRuntimeCheckpointer()` | `./checkpointer` | PostgresSaver backed by that pool, using the `langgraph` schema |

Imports do not read configuration, create clients, or connect to PostgreSQL. The
first getter call creates the pool using `readRuntimeDatabaseConfig()`, which reads
only `DATABASE_URL`. Migration and model configuration are not required. Invalid
runtime configuration throws at that boundary without falling back to another URL.

The pool is stored on `globalThis` for reuse throughout the Node.js process,
including development module reloads. Each client getter caches its wrapper within
its module; a reloaded wrapper still receives the same process-wide pool. Restart
the server after changing `DATABASE_URL` so the pool uses the new configuration.
Separate server processes each have their own pool.

Pool construction is lazy: [node-postgres opens connections only when needed](https://node-postgres.com/apis/pool).
Drizzle and PostgresSaver construction does not execute queries. Actual reads and
writes require human-provisioned database objects and runtime permissions. Idle
connection errors produce a fixed server log message without driver error details
or connection values; operation errors still propagate to their callers.

Do not call `PostgresSaver.setup()`, run migrations or grants, or close either the
shared pool or the checkpointer inside requests. PostgresSaver's `end()` closes its
pool, so it must not be used for per-request cleanup. Release any individually
checked-out `PoolClient` after use instead. Setup belongs to separate,
human-managed tooling using migration credentials.

## Human verification

1. Inspect `pool.ts`: there is one pool construction path, guarded by a
   process-wide cache and using only the runtime configuration reader.
2. Inspect `drizzle.ts` and `checkpointer.ts`: both call `getRuntimePool()` and
   pass that pool directly to their constructors. PostgresSaver explicitly uses
   `langgraph` as its schema.
3. Confirm there are no top-level getter calls, database queries, setup calls,
   migrations, grants, or pool shutdown calls in these modules.
4. In a human-controlled server context, repeated getter calls should preserve
   identity, and `getRuntimeDatabase().$client` should equal `getRuntimePool()`.
   Development reloads should keep the pool identity. No live database operation
   is needed to inspect this initialization behavior.

G04 prepares runtime access modules only. It does not establish database
connectivity or schema availability.

## Conversation metadata schema

`schema.ts` defines `public.conversations` using Drizzle's default PostgreSQL
schema. It contains only a generated UUID primary key, a required text title, and
required timezone-aware `created_at` and `updated_at` timestamps defaulting to the
insertion time. TypeScript properties use `createdAt` and `updatedAt`.

The `conversations_activity_idx` index orders `updated_at DESC, id DESC` for newest
activity with a stable tie-breaker. Future metadata mutation code must explicitly
advance `updatedAt` when activity changes; the insertion default does not update it.
Use the conversation UUID directly as LangGraph's `thread_id`. Transcripts belong
exclusively in checkpoint state; this schema defines no messages or auth tables.

The schema module contains only source definitions and has no runtime client or
configuration imports, so future Drizzle tooling can load it independently.
G05 does not generate migrations or create database objects. The human generates,
reviews, and applies migrations in G07 after G06 provides the setup tooling.

For human verification, inspect the four columns, primary key, timestamp defaults,
nullability, and activity index in `schema.ts` against `PLAN.md`. Confirm that there
are no transcript columns or additional tables. No database connection is required.
