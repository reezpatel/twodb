# SQLite migrations

Kysely migration modules owned by the api (`src/db/sqlite.ts` applies them
at boot). No external migration tool, no raw SQL files.

## Convention

- One module per migration, named `NNNN_description.ts`, exporting
  `up(db: Kysely<Database>)`.
- Register it in `index.ts` (`migrations` array) — array order is apply
  order.
- Each migration runs exactly once, inside its own transaction, tracked in
  the `schema_migrations` table.
- Migrations are append-only: never edit a module that has shipped, add a
  new one instead.
- Use `db.schema` builder calls with `.ifNotExists()` so a failed boot can
  be retried safely. Keep table shapes in sync with `src/db/schema.ts`.
