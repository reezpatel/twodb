# AGENTS.md — Garden

Knowledge base (notes + Notion-style databases). Read `README.md` for the data model first.

## Rules
- Endpoints: add/change the Zod schema in `src/schemas.ts` + `defineEndpoint` in `src/manifest.ts` first, then the route; run `pnpm gen:docs`. Never hand-edit `ENDPOINTS.md`/`endpoint.json`.
- Identity comes only from gateway `x-twodb-*` headers (`src/gateway-context.ts`); the active space from `x-garden-space` (validated against `x-twodb-space-ids`). Every query must be scoped by `workspace_id` + `space_id` (`store/base.ts` helpers).
- Dynamic SQL identifiers (`db_<uuid>` tables, `"<field uuid>"` columns) are only ever built through `domain/dynamic-table.ts` (`tableRef`, `columnRef`), which validate uuids. Never interpolate user strings into SQL; formula literals become bind parameters.
- New field types need: `shared/model.ts` (types, labels, operators), `SQL_TYPES` (if physical), `coerceValue` + `convertValues`, `fieldExpr`, filter semantics in `domain/filters.ts`, and UI in `webapp/src/database/fields/` (display, editor, icon).
- Keep the invariant: a page's `database_id` is its parent database, else the space's default Notes database.
- Run `pnpm smoke` (backend) and the Playwright scripts (`scripts/ui-check.mjs`, `scripts/ui-deep.mjs`) after behavioural changes.
- Webapp follows `blocks/CONVENTIONS.md`: one component per file, `partials/` presentational, `hooks/` logic. Styling uses `@twodb/blocks` tokens only (paper/stone/ink/outline/ion-deep…); floating surfaces use `.garden-float`.
- Talk to other apps only through the Gateway.
