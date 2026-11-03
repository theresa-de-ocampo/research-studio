# Human-invoked database setup

G06 supplies source tooling only. The human generates migration artifacts and
executes database operations in G07. Do not run these commands during application
startup, builds, requests, or agent verification.

## Commands

Run from the repository root with the installed dependencies:

| Command | Effect |
| --- | --- |
| `npm.cmd run db:generate` | Generate SQL and snapshots in `drizzle/` from `lib/server/db/schema.ts`; no credentials or database connection required. |
| `npm.cmd run db:migrate` | Apply reviewed, pending Drizzle migrations using migration credentials. |
| `npm.cmd run db:checkpoint-setup` | Run `PostgresSaver.setup()` for the `langgraph` schema using migration credentials. |
| `npm.cmd run db:setup` | Apply metadata migrations, then set up checkpoints; stop on failure. |

`drizzle.config.ts` shares the migration folder and journal location with the
runner: `drizzle.__drizzle_migrations`. Checkpoint migration history is recorded
in `langgraph.checkpoint_migrations`. Neither journal is runtime application data.
The Drizzle config deliberately contains no database credentials; use the npm
scripts for applying migrations, rather than `drizzle-kit migrate` or `push`.

## Configuration

The command runner is [`scripts/db/index.ts`](../scripts/db/index.ts). Its
migration-only configuration reader lives alongside it in
[`scripts/db/config.ts`](../scripts/db/config.ts). Application configuration stays
under `lib/server/config/`; the scripts reuse that directory's shared URL and
validation helpers without adding migration configuration to application modules.

The three database commands load optional local `.env*` files with `@next/env`,
including `.env.local` (except under `NODE_ENV=test`), using Next.js precedence.
They select development files unless `NODE_ENV=production`. Values already
supplied through the environment take precedence, so Cloud does not need a local
file. No file, credential, or reachable database is assumed to exist. Keep secrets
in ignored local files or human-supplied environment configuration.

`readMigrationConfig()` from `scripts/db/config.ts` requires `DATABASE_URL` and
`MIGRATION_DATABASE_URL` and verifies matching host, port, and database. Only the
migration URL is returned and passed to the temporary pool. The runtime URL is
used only for target comparison; there is no credential fallback. Model settings
are unnecessary. Missing or invalid required configuration fails before pool
creation. `db:generate` does not load or validate credentials.

The `tsx --conditions=react-server` invocation lets the standalone Node.js tools
import the existing `server-only` configuration modules. This condition is scoped
to these commands; it does not run them inside Next.js. Application runtime modules
continue to use only the existing runtime reader and shared runtime pool.

## Configuration reader verification

For human verification, import `readMigrationConfig` from `scripts/db/config.ts`
in a standalone server context using `tsx --conditions=react-server`. Importing
the reader does not load environment files, validate values, or connect to the
database; validation occurs when the reader is called.

Supply both database URLs with different credentials and the same target. The
reader should return only the migration URL. Change the host, port, or database
on one URL: the error should name both URL variables without printing either URL.
Missing or malformed URLs should identify the affected variable. Repeat with a
host or port override in the query string: it should be rejected. Do not print
returned credentials or invoke the command runner for configuration-only checks.

## G07 execution sequence

1. Confirm the intended database and protect existing data. Have a human provision
   roles and privileges as described in [database-roles.md](database-roles.md).
2. Supply both database URLs with separate credentials targeting that database.
3. Run `npm.cmd run db:generate`. Inspect all generated SQL and snapshots before
   applying them. Retain the generated artifacts in version control.
4. Run `npm.cmd run db:setup`, or the two individual database commands in the same
   order. These commands execute DDL and require explicit human execution.
5. Verify runtime grants, ownership, and journal restrictions separately. Confirm
   existing conversations and checkpoints survive repeated setup.

The runner never resets tables, truncates data, deletes migration history, creates
roles, or modifies grants. Drizzle applies pending migrations from its journal;
PostgresSaver uses its own versioned setup. Generated or future migration SQL can
still be destructive, so human review is required before every application.

Combined setup awaits metadata migrations before invoking checkpoint setup. A
metadata failure prevents checkpoint setup. The two stages do not share an atomic
transaction: a checkpoint failure leaves completed metadata migrations in place.
After a human investigates a failure, rerunning uses the migration journals;
never discard them to force a retry. Do not run setup commands concurrently.

Each database command creates one temporary migrator pool, shared by its stages,
and closes it in `finally`, including failure paths. It never borrows or closes
the runtime pool. Failures set a nonzero exit code and report the failed stage
without printing raw driver errors, SQL, connection URLs, or secret values. This
sanitization limits diagnostic detail; investigate using human-controlled database
administration tools. A failed command does not report success.

For G06 review, inspect command mappings, source/configuration imports, sequencing,
cleanup, and the role checklist without executing any database command. Linting
and static type checking do not establish connectivity or verify database access.
