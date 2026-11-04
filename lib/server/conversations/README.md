# Conversation mutation guard

`withConversationLock(id, operation, { signal })` serializes one conversation's mutations across application processes using the existing runtime pool. It returns `{ status: "busy" }` without calling `operation` if another session owns the key, or `{ status: "completed", value }` after the operation and lock cleanup succeed. Later API handlers should translate busy to HTTP 409 and use their sanitized database-error response for `ConversationLockError`.

The module is server-only and requires the Node.js runtime. Importing it does not read credentials or connect to PostgreSQL. A call validates the UUID, normalizes its case, hashes a fixed application namespace plus the UUID with SHA-256, and uses the first signed 64 bits as a decimal PostgreSQL bigint parameter. This convention must remain consistent across processes. A theoretical hash collision conservatively makes unrelated conversations contend; it cannot let matching UUIDs bypass locking.

## Ownership and cleanup

The guard checks out one dedicated connection for the entire operation. Both `pg_try_advisory_lock` and `pg_advisory_unlock` run on that same connection. It uses session locks rather than transaction locks, so ownership spans the graph's separate synchronous checkpoint transactions. It never exposes the lock connection to callback code or shuts down the shared pool. Metadata and graph/checkpointer work continue through their normal shared runtime clients.

The lock query is nonblocking. Pool checkout and lock/unlock queries also have bounded waits; a checkout or query failure is a storage error, not a busy response. A connection delivered after a cancelled/timed-out checkout is returned immediately. A failed or indeterminate acquisition, lost connection, or failed unlock destroys the checked-out connection rather than returning a potentially locked session to the pool. No database objects, migrations, grants, or in-memory locking substitutes are introduced.

Pass the request's AbortSignal in `options.signal` and use the callback's signal for model, graph, and stream execution. The callback signal also aborts if the lock connection fails. The callback must honor that signal, stop further mutations, and await all outstanding work before it rejects. The guard deliberately does not race callback completion against cancellation: doing so could release ownership while checkpoint work is still running.

**The callback promise defines the protected lifetime.** For ordinary mutations, await all writes inside it. For generation, await stream consumption, graph completion, and synchronous checkpoint completion or cancellation cleanup inside it. Do not return a Response/ReadableStream before it finishes, start unawaited background work, or release through a frontend completion callback. A route may expose a stream while its guarded producer remains pending, but the producer must retain and handle the guard's completion promise. Only report successful completion after guard cleanup succeeds.

A lock-session failure aborts the operation, but application code must cooperate with cancellation; this helper cannot fence writes that ignore its signal. All conversation mutations must use this same guard. Keep sufficient runtime pool capacity for lock holders plus their metadata/checkpoint connections, and handle storage errors rather than retrying in an unbounded loop.

## Human verification

No database connections or automated tests were run to implement this card. With the prepared local database and runtime credentials, a human should:

1. Invoke the guard in two independent Node processes using the same UUID. Keep the first callback open; confirm the second returns busy without entering its callback.
2. While the first remains open, use a different UUID and confirm its callback runs. Repeat the original UUID in uppercase and confirm it still contends.
3. Complete the first callback and confirm its UUID can be acquired again. Repeat with a thrown callback error.
4. Pass an AbortController signal, abort it, and have the callback await its shutdown before rejecting. Confirm another process stays busy during shutdown and can acquire afterward.
5. For later streaming integration, confirm ownership lasts through final checkpoint completion, including Stop and request cancellation. Also inspect failure handling when the checked-out lock connection is lost.

For direct Node execution, use the existing `tsx` runner with `--conditions=react-server` for the `server-only` import, load `.env.local` through the existing Next environment loader when needed, and close the runtime pool when the human verification process exits. Never use migration credentials for runtime locking.

References: [PostgreSQL session advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS), [advisory lock functions](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS), and [node-postgres connection release](https://node-postgres.com/apis/pool#releasing-clients).
