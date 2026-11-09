# AGENTS.md — @twodb/core-data

Read `README.md` first for the API surface.

## Boundaries
- This package is a **runtime client only**. If you're tempted to add
  "create schema", "grant privileges", or any DDL-for-another-app logic
  here — stop, that belongs in `apps/twodb/src/provisioning`.
- No app-specific logic. If a function only makes sense for one app, it
  doesn't belong here — put it in that app instead.
- Keep the three concerns (`db`, `storage`, `config`) independently
  importable via their subpath exports — don't introduce cross-imports
  between them.

## When changing `db`
- Both dialects (Postgres via `createPgDb`, SQLite via `createSqliteDb`)
  must keep working — several apps rely on each.
- `runSqlMigrations` is intentionally simple (no rollback, no up/down
  pairs) — do not grow it into a full migration framework inside this
  package. If an app needs more, it manages that itself.

## When changing `storage`
- Any new backend must implement the full `StorageAdapter` interface.
  `getSignedUrl` is optional — only implement it where the backend
  actually supports pre-signed access (local fs cannot, without a serving
  route the *app* owns).

## Testing
- `pnpm --filter @twodb/core-data test` runs `tsx --test` over
  `src/**/*.test.ts`. Add tests next to the code they cover, not in a
  separate top-level `test/` tree.
