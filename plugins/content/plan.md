# Content plugin — plan

The content plugin manages everything users keep in twodb: notes, tasks,
lists, boards. It is a Notion-style structured-content engine: a tree of
**folders** and **sections** per workspace. All notes live in one shared
core table; each section owns a runtime-created **property table** whose
columns the user can reshape at will, and rows render as list, table, kanban,
or project views.

- Plugin id: **`io.twodb.content`** (package `@twodb/content`)
- Postgres schema: **`io_twodb_content`** (via `pluginSchemaName`)
- API prefix: `/api/v1/io.twodb.content` (host-applied, never hardcoded)
- Frontend routes: `/io.twodb.content/...` under the app shell
- Events: `io.twodb.content.<noun>.<verb-past>` via the outbox

The existing `apps/web/src/scenes/notes/` scene stays in the app as-is; the
plugin ships the backend, the data hooks, and the sidebar file tree, and its
routes are wired into the host (`apps/api`, `apps/web`) exactly like identity.

---

## 1. Concepts

| Concept | Meaning |
| --- | --- |
| **Node** | A row in `content_nodes`: either a `folder` or a `section`. Folders nest; sections are leaf tables. Root can hold both. |
| **Folder** | Pure organization. No table, no columns. |
| **Section** | A user-facing table. Owns one runtime property table (`sec_<node_id>_props`) holding its user-defined columns. |
| **Note / row** | A row in the shared `content_notes` table. Always has `title`, `content`, `completed`, `deleted`, `tags`, `links`, `attachments`, plus any user columns (via the section's props table). |
| **Column** | A physical column on a section's props table. Physical name is a random id (`col_<random>`); display name + type + options live in the section's `columns_config` jsonb. |
| **View** | A named, saved presentation of a section: type + filters + sorts + grouping + column visibility. One view per section is `is_default`. |
| **Identifier** | Human slug for a section (unique per workspace), usable anywhere a node id is accepted. |

## 2. Tenancy

Every table carries `workspace_id`; every route resolves the active workspace
from the identity plugin (`x-workspace-id` → `request.principal`) and filters
by it. Notes live in one shared table keyed by `section_id`; each section
owns exactly one property table. Sections are created inside a workspace and
never shared across workspaces (grants/sharing come later via identity's
grant tables).

## 3. Data model

All static tables live in schema `io_twodb_content`, created by kysely
migrations (`runPluginMigrations`). Section **property** tables are
**runtime DDL** — they are not migrations (§6).

### 3.1 `content_nodes` — the tree

| column | type | notes |
| --- | --- | --- |
| `id` | text pk | `newId("nod")` — prefixed id (`nod-…`), see `docs/database.tables.prefix.md` |
| `workspace_id` | text not null, indexed | tenancy filter (`wks-…`) |
| `parent_id` | text null → `content_nodes.id` | null = root; on delete restrict |
| `type` | text not null | `'folder' \| 'section'` |
| `name` | text not null | display name |
| `identifier` | text not null | slug; unique per `(workspace_id)` for sections |
| `position` | double precision not null | manual ordering within parent (fractional insertion) |
| `deleted` | boolean not null default false | soft delete (trash) |
| `show_in_overview` | boolean not null default true | surfaces section in the Overview scene |
| `columns_config` | jsonb not null default `'[]'` | section columns registry (§3.5); `[]` for folders |
| `default_view` | text null | denormalized id of the default view (kept in sync with `content_views.is_default`) |
| `created_by` | text not null | user id (`usr-…`) |
| `created_at` / `updated_at` | timestamptz not null | |

Indexes: `(workspace_id, parent_id, position)` for tree reads;
partial unique `(workspace_id, lower(identifier)) where type='section' and not deleted`.

### 3.2 `content_views` — saved views

| column | type | notes |
| --- | --- | --- |
| `id` | text pk | `newId("viw")` |
| `section_id` | text not null → `content_nodes.id` | cascade on section hard-delete |
| `workspace_id` | text not null, indexed | redundant but keeps every query tenant-filtered |
| `name` | text not null | |
| `type` | text not null | `'list' \| 'table' \| 'kanban' \| 'project'` (extensible) |
| `config` | jsonb not null default `'{}'` | filters, sorts, grouping, hidden columns (§3.6) |
| `is_default` | boolean not null default false | one per section, enforced in a transaction |
| `position` | double precision not null | tab ordering |
| `deleted` | boolean not null default false | |
| `created_at` / `updated_at` | timestamptz not null | |

Partial unique index: one default per section —
`(section_id) where is_default and not deleted`.

### 3.3 `content_notes` — one shared notes table

Every note of every section lives in a single **static** table (created by
migration). Since user-defined columns no longer live on the note row, every
section's core row has an identical shape — the table is free of anything
section-specific, and a note's section is just a column:

| column | type | notes |
| --- | --- | --- |
| `id` | text pk | `newId("nte")` — prefixed id; survives moves between sections |
| `workspace_id` | text not null, indexed | tenancy filter |
| `section_id` | text not null → `content_nodes.id`, indexed | owning section; rewriting it **is** the move (§3.7) |
| `title` | text not null default `''` | |
| `content` | text not null default `''` | markdown body (block jsonb is a later evolution) |
| `completed` | boolean not null default false | drives kanban "done", list checkboxes |
| `deleted` | boolean not null default false | trash |
| `position` | double precision not null default 0 | manual/kanban ordering within the section |
| `tags` | jsonb not null default `'[]'` | `[{ "label", "tone": "red\|purple\|blue\|green", "link"? }]` (matches the scene's TagChip) |
| `links` | jsonb not null default `'[]'` | connections to other nodes/notes/urls: `[{ "kind": "note\|node\|url", "target": "<id\|url>", "label" }]` |
| `attachments` | jsonb not null default `'[]'` | `[{ "name", "url", "size"?, "mime"? }]` |
| `created_by` | text not null | |
| `created_at` / `updated_at` | timestamptz not null default now() | |

Indexes: `(section_id, position) where not deleted` for row listings;
`(workspace_id)` for tenancy sweeps.

### 3.4 Section property tables — `sec_<node_id>_props`

The only runtime-DDL tables. One per section, created when the section node
is created, starting with exactly two columns:

| column | type | notes |
| --- | --- | --- |
| `note_id` | text pk → `content_notes.id` on delete cascade | the single FK back to the core note (`nte-…`) |
| `workspace_id` | text not null | keeps every query tenant-filtered |

…plus one physical column per user column: `col_<random 10-char alnum>`,
added/altered/dropped as the user edits the schema. Property rows are
**lazily created**: a note gets a props row only when a value is first set
(writes upsert on `note_id`; reads `LEFT JOIN`, missing row = all values
null). A freshly created section's props table is therefore empty — no
backfill, no per-note rows.

Physical name derives from the node id, never user input: `sec_` +
**lowercased** base62 body of the `nod-…` id + `_props` (lowercasing because
unquoted Postgres identifiers fold case — the full base62 alphabet is kept
only in the id itself).

Dropping a section = `DROP TABLE sec_<id>_props` + delete node row (hard) or
just `deleted = true` on the node (soft; props table dropped on trash-empty
or 30-day sweep).

### 3.5 `columns_config` jsonb shape (on the section node)

```jsonc
[
  {
    "column_id": "col_a3f9kz20qm",   // physical column name
    "name": "Status",                // display name, user-editable
    "type": "select",                // registry key (§4)
    "options": {                     // type-specific
      "choices": [
        { "value": "draft",     "label": "Draft",     "tone": "blue"  },
        { "value": "published", "label": "Published", "tone": "green" }
      ]
    },
    "relation": { "section_id": "…" },  // relation columns only
    "width": 180,                       // optional table-view hint
    "position": 0                       // column order
  }
]
```

The physical column name is **never** derived from the display name — renames
are free, and two columns may share a display name.

### 3.6 View `config` jsonb shape

```jsonc
{
  "filters": [
    { "column_id": "col_a3f9kz20qm", "op": "is",        "value": "draft" },
    { "column_id": "title",          "op": "contains",  "value": "launch" },
    { "column_id": "completed",      "op": "is",        "value": false }
  ],
  "sorts": [
    { "column_id": "updated_at", "dir": "desc" }
  ],
  "group_by": "col_a3f9kz20qm",       // kanban lanes / table groups
  "hidden_columns": ["col_…"],
  "search": ""                        // optional saved full-text term
}
```

Filter ops v1: `is, is_not, contains, not_contains, gt, lt, gte, lte,
is_empty, is_not_empty`. Server-side whitelisted; values validated against
the column's type before touching SQL.

### 3.7 Moving a note to another section

Because the core row is section-agnostic, a move is cheap and the note keeps
its identity:

1. `UPDATE content_notes SET section_id = :target WHERE id = :note` — one
   row, same id, so `links` pointing at this note from other notes keep
   working.
2. `DELETE FROM sec_<source>_props WHERE note_id = :note` — property values
   belong to the old section's schema and are dropped.
3. Nothing is inserted into `sec_<target>_props` — lazy creation means the
   note shows every target-section column as empty until edited.

`title`, `content`, `completed`, `tags`, `links`, `attachments` all travel
with the note. Emits `io.twodb.content.row.moved`.

## 4. Column type registry

Server-owned mapping; the registry is the single source of truth for DDL,
casting, and validation (`service/lib/columns/registry.ts`):

| type | postgres type | cast rule (type change) | notes |
| --- | --- | --- | --- |
| `text` | `text` | `USING col::text` | |
| `number` | `double precision` | `nullif(trim(col), '')::numeric` | failures → null |
| `checkbox` | `boolean` | truthy strings → true, else null | |
| `date` | `timestamptz` | `col::timestamptz` guarded | failures → null |
| `url` | `text` | `col::text` | display validation only |
| `select` | `text` | keep if in choices, else null | options in `columns_config` |
| `multi_select` | `jsonb` (array) | split on `,` for text→multi | failures → null |
| `relation` | `text` | `col::text` guarded | target section in config; value is a `nte-…` id |
| `person` | `text` | `col::text` guarded | identity user id (`usr-…`) |

**Type-change semantics (decided): cast best-effort, null on failure.**
Implementation: `ALTER TABLE sec_<id>_props … ALTER COLUMN … TYPE <t> USING
<safe_cast>`, where `<safe_cast>` is a per-type `CASE WHEN … THEN cast ELSE
NULL END` expression from the registry. Postgres rejects nothing;
unconvertible values become `NULL`. Adding a column = `ADD COLUMN col_x
<type>` on the props table; removing = `DROP COLUMN` (after the view-configs
referencing it are cleaned). Column add/remove/type-change all run inside one
transaction with the `columns_config` update.

## 5. API surface

All routes under `/api/v1/io.twodb.content`, all require a verified session +
active workspace (identity hook). Permission claims (checked per route via the
identity authz decorator):

- `plugin.twodb.content:content.read` — tree, schema, rows, views
- `plugin.twodb.content:content.write` — row insert/edit, column ops, views
- `plugin.twodb.content:content.manage` — node create/move/delete

`roleDefaults`: manager gets all three; member gets read + write.

`:id` path params accept **either the node uuid or the section identifier** —
resolved in a preHandler (`resolveNode`). Column references in bodies are
always `column_id`s; the response DTOs always carry both `column_id` and
`name` so the client can render by name and write back by id.

### 5.1 Tree

| method | path | body → response |
| --- | --- | --- |
| GET | `/tree` | → flat list of non-deleted nodes for the workspace (`id, parent_id, type, name, identifier, position, show_in_overview`); client builds the hierarchy (sidebar file tree) |
| POST | `/nodes` | `{ parent_id?, type, name, position? }` → node (+ creates the props table when `type=section`, + default list view) |
| GET | `/nodes/:id` | → node detail incl. `columns_config`, `default_view`, views list |
| PATCH | `/nodes/:id` | `{ name?, identifier?, show_in_overview?, default_view? }` → node |
| POST | `/nodes/:id/move` | `{ parent_id: uuid \| null, position: number }` → node (reparent + reorder; rejects moving a folder into its own descendant) |
| DELETE | `/nodes/:id` | soft (`deleted=true`, cascades flag to descendants); `?hard=true` drops the props table (manage claim) |

### 5.2 Section schema (columns)

| method | path | body → response |
| --- | --- | --- |
| GET | `/sections/:id/schema` | → `{ section, columns: [{ column_id, name, type, options?, relation?, position, mandatory }] }` — the table schema DTO the notes scene renders from |
| POST | `/sections/:id/columns` | `{ name, type, options?, position? }` → column (generates `col_<random>`, `ADD COLUMN`, appends to `columns_config`) |
| PATCH | `/sections/:id/columns/:columnId` | `{ name?, type?, options?, position? }` → column (type change runs the registry's safe cast, §4) |
| DELETE | `/sections/:id/columns/:columnId` | → 204 (`DROP COLUMN`; strips the id from every view config of the section) |

### 5.3 Rows (notes)

| method | path | body → response |
| --- | --- | --- |
| GET | `/sections/:id/rows` | query: `view=<viewId>` **or** inline `filters/sorts/search/limit/cursor`; → `{ rows, next_cursor }`. Core fields on the row, user cells in `values` keyed by `column_id` (props `LEFT JOIN`) |
| POST | `/sections/:id/rows` | `{ title?, content?, completed?, position?, tags?, links?, attachments?, values? }` → row (props row upserted only if `values` non-empty) |
| GET | `/sections/:id/rows/:rowId` | → row |
| PATCH | `/sections/:id/rows/:rowId` | partial `{ title?, content?, completed?, deleted?, position?, tags?, links?, attachments?, values? }` → row |
| DELETE | `/sections/:id/rows/:rowId` | soft delete; `?hard=true` deletes (props row cascades) |
| POST | `/sections/:id/rows/:rowId/move` | `{ target_section_id }` → row with new `section_id`; source props row deleted, target props start empty (§3.7) |
| POST | `/sections/:id/rows/reorder` | `{ row_id, before_row_id? \| after_row_id? }` → recomputed fractional position (kanban drag-drop) |

Values are validated + coerced against the column registry before insert
(`"42"` into a number column → `42`; garbage → 400 with the offending
`column_id`). `tags` / `links` / `attachments` are shape-validated jsonb
arrays written straight to the core row.

### 5.4 Views

| method | path | body → response |
| --- | --- | --- |
| GET | `/sections/:id/views` | → views ordered by `position` |
| POST | `/sections/:id/views` | `{ name, type, config?, is_default? }` → view |
| PATCH | `/sections/:id/views/:viewId` | `{ name?, config?, position? }` → view |
| POST | `/sections/:id/views/:viewId/default` | → clears other defaults, sets this one, syncs `content_nodes.default_view` (transaction) |
| DELETE | `/sections/:id/views/:viewId` | → 204 (if it was default, oldest remaining becomes default) |

### 5.5 Events (outbox)

`io.twodb.content.node.created / .renamed / .moved / .deleted`,
`io.twodb.content.column.added / .changed / .removed`,
`io.twodb.content.row.created / .updated / .deleted / .moved`,
`io.twodb.content.view.created / .updated / .defaulted / .deleted`.
DTO types added to `@twodb/contracts` (`content.ts` + event map entries).

## 6. Runtime DDL strategy

- Static tables (`content_nodes`, `content_views`, `content_notes`) ship as
  numbered kysely migrations via `runPluginMigrations` — same pattern as
  identity.
- Only the per-section **props tables** are runtime DDL.
  `service/lib/tables.ts` owns `createPropsTable(nodeId)`, `addColumn`,
  `alterColumnType`, `dropColumn`, `dropPropsTable`. All DDL runs on the
  **unscoped** `typedDb` with explicit `.withSchema(CONTENT_SCHEMA)` (kysely's
  WithSchemaPlugin doesn't cover schema-builder edge cases), while row
  queries use the scoped `contentDb()` handle: notes from the static
  `content_notes` table, props via dynamic `sql.table(propsName)` `LEFT
  JOIN`ed on `note_id`.
- Every mutating DDL runs in a transaction with its `columns_config`/view
  bookkeeping update, so registry and physical table never drift.
- Table/column names are always server-generated (`sec_<uuid>_props`,
  `col_<random>`) — no user input ever reaches a DDL identifier.

## 7. File structure (mirrors identity)

```
plugins/content/
├── package.json                 @twodb/content — exports ./service ./view ./shared/*
├── readme.md
├── tsconfig.json
├── shared/
│   ├── manifest.ts              contentManifest { id: "io.twodb.content" }
│   └── constants.ts             PLUGIN_ID, CONTENT_SCHEMA, node/view/column type unions
├── service/
│   ├── index.ts                 TwodbContentServiceManifest: permissions, roleDefaults, plugin()
│   ├── db/
│   │   ├── index.ts             contentDb() via scopedDb
│   │   ├── schema.ts            ContentDB kysely types (static tables; props tables are dynamic)
│   │   └── migrations/          001-nodes.ts, 002-views.ts, 003-notes.ts, index.ts buildMigrations()
│   ├── lib/
│   │   ├── tables.ts            runtime DDL for section props tables
│   │   ├── columns/registry.ts  type registry: pg type, safe-cast SQL, validate/coerce
│   │   ├── columns/columns.ts   add/rename/retype/remove orchestration
│   │   ├── filters.ts           view-config filters/sorts → kysely wheres (whitelisted)
│   │   ├── tree.ts              move/reparent/descendant checks, fractional positions
│   │   └── resolve-node.ts      preHandler: uuid-or-identifier → node
│   └── routes/
│       ├── index.ts             registerRoutes orchestrator
│       ├── tree/                §5.1
│       ├── sections/            §5.2 (+ schema DTO)
│       ├── rows/                §5.3
│       └── views/               §5.4
└── view/
    ├── index.ts                 TwodbContentViewManifest { provider, plugin }
    ├── plugin.ts                react-pluggable; exposes useContent() fn
    ├── utils.ts                 apiClient = new ApiClient("io.twodb.content")
    ├── provider/
    │   └── ContentProvider.tsx  tree query (tanstack-query), active section context
    ├── hooks/
    │   ├── use-tree.hook.ts
    │   ├── use-section-schema.hook.ts
    │   ├── use-rows.hook.ts     keyed by (section, view) with cursor pagination
    │   ├── use-row-mutations.hook.ts
    │   ├── use-column-mutations.hook.ts
    │   └── use-view-mutations.hook.ts
    ├── components/
    │   └── content-tree/        sidebar file tree (folders/sections, dnd move)
    │       ├── content-tree.tsx
    │       └── content-tree.style.jsx
    └── scenes/
        └── section-scene/       renders a section by :identifier with its views
```

### Host wiring (the only host edits)

- `apps/api/src/index.ts` — add `TwodbContent` to the plugins array
  (prefix comes from the manifest id, like identity).
- `apps/web/src/main.tsx` — add `ContentPlugin` to the plugins array.
- `apps/web/src/shell/AppShell.tsx` — mount the plugin's routes
  (`/io.twodb.content/s/:identifier` → section scene) and place
  `<ContentTree />` in the sidebar. The notes scene keeps working against the
  plugin through the new hooks (mock state swapped for tanstack-query, scene
  files themselves unchanged in structure).

## 8. Notes-scene fit check

Everything the notes scene does maps onto §5:

| scene feature | API |
| --- | --- |
| sidebar tree (folders, channels, nesting) | `GET /tree`, `POST /nodes/:id/move` |
| list of notes, box filter, search, sort | `GET /sections/:id/rows` with view/inline filters (`deleted`, `completed`, `search`, sorts) |
| open note, editor body | `GET /rows/:rowId` (`title`, `content`) |
| tags, attachments, "Belongs to" relations | `tags` / `attachments` / `links` jsonb on the core row; row PATCH |
| move note to another section | `POST /rows/:rowId/move` (§3.7) |
| properties panel (type, status, date, tags…) | columns in schema DTO; values in row `values` |
| kanban lanes, drag between lanes | view with `group_by` + `rows/reorder` + row PATCH |
| add issue inline | `POST /rows` |
| views tabs, default view | §5.4 |
| table view placeholder | `GET /schema` + `/rows` (table view config) |

The hardcoded mock columns/teams/categories in the kanban & project mocks
become select/person columns seeded by the client on first run.

## 9. Build order (checklist)

1. ✅ **Scaffold** — package.json, shared manifest/constants, tsconfig; registered in both hosts.
2. ✅ **Migrations + static schema** — `content_nodes`, `content_views`, `content_notes`; `contentDb()`; schema types.
3. ✅ **Tree routes** — CRUD + move + `GET /tree`; sidebar tree renders live data.
4. ✅ **Props-table DDL + column registry** — props table create/drop, add/rename/retype/remove with safe casts (all DDL + bookkeeping in one transaction); schema DTO route.
5. ✅ **Rows routes** — CRUD over core + props join, tags/links/attachments, validation/coercion, filters/sorts/search, cursor pagination, reorder, move.
6. ✅ **Views routes** — CRUD + default handling (delete promotes oldest remaining).
7. ✅ **Events** — bus emissions (`io.twodb.content.*`) + DTO types in `@twodb/contracts`.
8. ✅ **View plugin** — provider + hooks + `ContentTree` in the sidebar + `SectionScene` at `/io.twodb.content/s/:identifier`.
9. ✅ **Notes scene cutover** — `/notes/:identifier?` renders live sections: list (box/search/sort client-side over rows), real schema-driven table, kanban lanes from the first select column (dnd → PATCH + reorder), project task table; dead mock files (Editor/PropertiesPanel/NotesWorkspace/NoteList) removed; sidebar tree navigates into the scene. Editor layout (spec'd later): list view → editor docked in the second pane; table/kanban/project → editor floats as a right drawer (widens when the panel opens so it never covers text); "open as page" in the editor chrome navigates to `/notes/:identifier/:noteId` — full-page editor with the properties panel docked + collapsible on the right. Properties panel is schema-driven (type-appropriate control per column, "Add property" creates real columns); editor saves title/content with a 600ms debounce.
10. ⬜ **Polish** — trash/restore flow, empty states, tests for registry casts + filter builder + tree moves.

### Implementation notes (deviations discovered during the build)

- `multi_select` columns are `jsonb` arrays, not `text[]` — uniform with
  `tags`/`links`/`attachments`, and the pg driver serializes JS arrays as
  Postgres array literals (not JSON), so all jsonb writes go through a
  `jsonb()` pre-stringify helper (`service/lib/serialize.ts`).
- Route gating is session + workspace membership (`requireWorkspace`); the
  declared `content.read/write/manage` claims activate once the role system
  seeds plugin claims.
- Scenes must claim their shell grid cell (`grid-column: 2 / -1; grid-row: 1 / 3`)
  — see `NotesScene.style.jsx`; without it the scene collapses to auto height.
- `NavPanelTree` (react-arborist) captures `initialData` at mount only —
  `ContentTree` gates on loaded data and remounts via a dataset key.
- `IdentityProvider` now persists/restores `activeWorkspaceId` in localStorage
  and defaults to the first membership, so `ApiClient` always sends
  `x-workspace-id`.
- Vite does not watch `plugins/` (outside the web root) — restart the web dev
  server after editing plugin source if HMR serves stale modules.
