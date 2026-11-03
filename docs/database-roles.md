# Human-managed database roles and privileges

Role provisioning and grants belong to G07 and the human database administrator.
The setup tooling does not create roles, change ownership, grant access, or elevate
privileges. Ordinary application execution must not require administrator access.

## Provisioning checklist

- `app_migrator` authenticates through `MIGRATION_DATABASE_URL`, owns application
  and checkpoint objects, and can create the required schemas, tables, and indexes.
  It does not require superuser privileges.
- `app_service` authenticates through `DATABASE_URL`, can connect to the intended
  database and use the runtime schemas, and receives only `SELECT`, `INSERT`,
  `UPDATE`, and `DELETE` on the four runtime tables below.
- `app_service` owns no objects, cannot create schema objects, and has no membership
  in the migrator role. Check inherited and `PUBLIC` privileges as well as direct
  grants.
- Both URLs target the same database. Do not use migrator credentials in the app.

| Object | Required runtime access |
| --- | --- |
| `public.conversations` | Select, insert, update, delete |
| `langgraph.checkpoints` | Select, insert, update, delete |
| `langgraph.checkpoint_blobs` | Select, insert, update, delete |
| `langgraph.checkpoint_writes` | Select, insert, update, delete |
| `drizzle.__drizzle_migrations` | None |
| `langgraph.checkpoint_migrations` | None |

## Existing grants and future objects

G06 assumes the human has configured default privileges for future tables; the
commands rely on those human-managed privileges without adding grants. PostgreSQL
default privileges apply to objects created by the configured creating role and
do not retroactively grant access to existing objects. The human must verify the
correct creator (`app_migrator`), schemas, database/schema access, and existing
table grants.

Broad defaults granting access to all future tables can also grant access to
migration journals. Before enabling application access after setup, the human
must ensure both journals remain inaccessible to `app_service`, including through
inherited or `PUBLIC` privileges. In particular, the checkpoint journal shares
`langgraph` with runtime tables, so schema usage alone does not isolate it. Keep
the Drizzle journal schema restricted and remove any unintended journal grants
as a human-managed operation. Recheck these restrictions after future migrations
or changes to default privileges.

Once setup is complete, the human verifies ownership and CRUD permissions, checks
that runtime DDL and journal access are denied, and exercises runtime CRUD in a
transaction that is rolled back. See [database-setup.md](database-setup.md) for
the command sequence. Agents must stop if any permission change or live database
operation is required.
