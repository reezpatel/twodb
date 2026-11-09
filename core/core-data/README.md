# @twodb/core-data

Runtime data-access primitives shared by every app:

- `db` — Kysely client factories: `createPgDb()` for the shared Postgres
  cluster (bound to the one schema TwoDB provisioned for your app) and
  `createSqliteDb()` for apps/components that keep local state. Also a
  minimal `runSqlMigrations()` helper for app-local schema evolution.
- `storage` — blob storage abstraction (`createLocalStorage`,
  `createS3Storage`) behind one `StorageAdapter` interface.
- `config` — `loadConfig(zodSchema)` to parse/validate `process.env` once,
  fail fast with readable errors.

**No provisioning logic lives here.** Creating a new app's Postgres schema
and role is `apps/twodb`'s job (see its `ENDPOINTS.md` /
`src/provisioning/`). This package only ever connects to a schema that
already exists.

## Usage
```ts
import { createPgDb, loadConfig, commonConfigFields } from "@twodb/core-data";
import { z } from "zod";

const config = loadConfig(z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url(),
}));

const db = createPgDb<MyAppSchema>({
  connectionString: config.DATABASE_URL,
  schema: "twomail",
});
```
