# Garden

Knowledge base: AFFiNE-style notes (sidebar, doc page, properties, backlinks,
peek view) with Notion-style databases. No whiteboard, no AI.

Shape: `backend+webapp` · backend `:6410` · webapp `:6509` · Postgres schema `garden`

## Data model

| Table | What |
|---|---|
| `database_record` | **One polymorphic node table.** `kind = 'database' \| 'field' \| 'page'`. Pages carry raw TipTap JSON in `content`; fields carry `{type, options, relation, rollup, formula…}` in `config`; databases carry `{isDefault, inline}`. |
| `database_view` | Saved views (`table`, `kanban`, `list`, `gallery`, `calendar`) with filter tree / sorts / group-by / field order+widths. |
| `db_<uuid>` | **A real Postgres table per database.** `record_id` + one column per field, **named by the field's uuid**, typed per field type (`text`, `double precision`, `boolean`, `timestamptz`, `text[]`, `uuid[]`). |
| `record_link` | page → page mentions (backlinks), rebuilt on every content save. |
| `asset` | uploaded images/covers (bytea, ≤10 MB). |

Invariants:
- **Every page lives in a database.** `page.database_id` = its parent if the parent is a database, else the space's default **Notes** database (shown as *All docs*, created lazily, one per space). Pages also have `parent_id` for Notion-style nesting.
- Moving a page into/out of a database moves its property row (properties don't carry across databases).
- Field type changes go add-temp-column → convert in JS → drop → rename (`domain/dynamic-table.ts#replaceColumn`, `domain/values.ts#convertValues`), so every type pair works (text → multi-select creates options, etc.).
- Every field — physical, system (`title`, `created_time`, `updated_time`, `created_by`), relation, **rollup** (correlated subquery) and **formula** (compiled to SQL, `domain/formula.ts`) — compiles to one SQL expression (`domain/field-expr.ts`), so filters/sorts work uniformly.
- Two-way relations keep the reverse column in sync on write.
- Soft delete: trashing takes the whole subtree (`trash_root_id`); restore re-parents to root if the parent is gone; permanent delete drops nested databases' tables and relation fields pointing at them.
- Scope = `workspace_id` (gateway) + `space_id` (`x-garden-space` header, must be one of the caller's spaces).

## Code map

```
src/
  shared/model.ts        contract shared with the webapp (@shared alias)
  schemas.ts, manifest.ts Zod schemas → routes validation + ENDPOINTS.md
  db/schema.ts           static tables
  domain/                dynamic tables, values/conversion, formula compiler, field → SQL, filters
  store/                 base (records, default db, catalog), records, rows, schema (fields/views), trash/search
  routes/                records, databases, assets
webapp/src/
  shell/                 sidebar (tree DnD, favorites, spaces), header bar, ⌘K search
  doc/                   DocEditor (cover/icon/title/properties/BlockEditor/backlinks), autosave hook
  database/              DatabaseView (+ page / inline block), views/, fields/ (display, editors, menus), partials/ (toolbar, filter builder…)
  peek/RowPeek.tsx       AFFiNE peek view (?peek=<id>)
```

The editor is `BlockEditor` from `@twodb/editor` (TipTap v3, JSON): slash menu,
block gutter (+ / drag), selection toolbar, `@` / `[[` page mentions, callouts,
toggles, tables, images, and a `databaseView` node Garden renders with
`database/DatabaseBlock.tsx`.

## Dev

```bash
pnpm --filter @twodb/app-twodb provision:dev garden   # → GARDEN_DATABASE_URL / GARDEN_PROVISION_TOKEN into .env
pnpm --filter @twodb/app-garden dev                    # backend :6410 (behind the real gateway)
pnpm --filter @twodb/app-garden-webapp dev             # webapp :6509 → gateway :6400

# standalone (no control plane): fake gateway identity
GARDEN_SKIP_REGISTER=1 pnpm --filter @twodb/app-garden dev
pnpm --filter @twodb/app-garden dev:shim               # :6498 → :6410
TWODB_GATEWAY_URL=http://localhost:6498 pnpm --filter @twodb/app-garden-webapp dev

pnpm --filter @twodb/app-garden smoke                  # 36 end-to-end API checks (via the shim)
node apps/garden/scripts/ui-check.mjs && node apps/garden/scripts/ui-deep.mjs   # Playwright walkthroughs → /tmp/garden-ui
pnpm --filter @twodb/app-garden gen:docs               # after changing manifest.ts
```

## Not in v1
Realtime collaboration (last write wins, 700 ms debounced autosave), sharing/permissions
per page, page history, import/export, journals, formula editor autocomplete.
