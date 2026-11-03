# Server configuration

Import the reader for the operation being initialized and call it at that usage
boundary. Importing these modules defines schemas only; it does not read environment
variables, construct clients, or open connections. All modules use Next.js's
`server-only` marker to prevent imports into Client Components.

| Reader                                       | Required variables                       | Returned configuration                              |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `readRuntimeDatabaseConfig` from `./runtime` | `DATABASE_URL`                           | `{ databaseUrl }` for runtime access only           |
| `readModelConfig` from `./model`             | `OPENAI_API_KEY`, `OPENAI_MODEL`         | `{ apiKey, model }` with no model default           |
| `readMigrationConfig` from `./migration`     | `DATABASE_URL`, `MIGRATION_DATABASE_URL` | `{ databaseUrl }` containing only the migration URL |

Use the returned model configuration when constructing the model client. Do not
log or serialize reader results: they contain credentials. Validation throws plain
errors containing variable names only, without input values or underlying errors.

Next.js loads local configuration from `.env.local`. The root `.env.example`
contains placeholders only; replace them with human-supplied values in the ignored
local file. Other environments supply values through their supported configuration
mechanism. These readers do not load files themselves. The standalone database
tooling loads its environment before calling the migration reader; see
[database setup](../../../docs/database-setup.md).

Database URLs must use `postgres://` or `postgresql://` and explicitly include a
host, user, and database path. Use the same host, port, and database for both URLs,
with separate runtime and migration credentials. Omitted ports are compared as
`5432`. Host comparison ignores case; database comparison preserves case and
follows pg's URL decoding. Host aliases are not resolved over the network.
Query parameters overriding `host`, `port`, or `connectionString` are rejected so
the database comparison cannot be bypassed. Other options, such as `sslmode`, do
not need to match. No reader falls back to another credential or checks live
connectivity.

## Human verification

Exercise the readers manually in a server context with configuration supplied by
the human. Do not print returned secrets or commit local configuration.

1. Import each module without calling a reader. No variables should be required.
2. Supply only `DATABASE_URL` and call `readRuntimeDatabaseConfig`. It should work
   without migration or model settings. Omit `DATABASE_URL`, even while supplying
   `MIGRATION_DATABASE_URL`: the error should name only `DATABASE_URL`.
3. Supply only the two model variables and call `readModelConfig`. The returned
   `model` should match `OPENAI_MODEL`. Omit either variable, or supply whitespace
   only: the error should name the invalid variable without exposing its value.
4. Supply both database URLs with different credentials and the same target.
   `readMigrationConfig` should return the migration URL. Change the host, port,
   or database on one URL: the error should name both URL variables without
   printing either URL. Missing or malformed URLs should identify the affected
   variable. Repeat with a host or port override in the query string: it should
   be rejected.

```
npx --no-install tsx --conditions=react-server --env-file=.env.local lib/server/config/confirm.ts
```

G03 adds configuration readers only. Database/model client initialization and
migration commands belong to later goals. No database operation is needed for
this verification.
