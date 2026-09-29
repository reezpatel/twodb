# AGENTS.md — twodb working agreements

Guidance for anyone (human or agent) working in this repo.
`DESIGN.md` documents the Oldworld design language; `NIXOS.md` the Nix packaging.

1. IMPORTANT: Don't add redundant comments, only add comments that add value.
2. Only add comments when absolutely necessary.

## Architecture

A single Tauri 2 desktop app talks to one Hono server; runners connect outbound
over WebSockets. There is no plugin system anymore.

- `apps/desktop` — the app: React 19 + Vite + React Router + Tauri shell.
  Every screen lives in `src/routes/<app>/` as `<app>-scene.tsx` plus a
  `use-<app>-scene.ts` hook. Nav rail entries come from `src/lib/apps.ts`.
- `apps/server` — Hono backend (:3001). REST + WS routes in `src/routes/`,
  domain logic in `src/lib/`. Postgres via Kysely — migrations in
  `src/migrations/` run automatically on startup (`lib/migrate.ts`) unless
  `TWO_DB_SKIP_AUTO_MIGRATION` is set.
- `apps/runner` — outbound runner agent; dials home to the server over WS
  (never the reverse) and executes jobs.

Legacy `plugins/code/` is reference-only for a pending workbench port — never
import from it.

## Frontend conventions

1. **shadcn/ui (new-york) + Tailwind v4**, Oldworld theme forced dark. Style
   with tokens (`text-muted-foreground`, `bg-card`, `border`, …) — never
   hardcode colors or spacing. Components in `src/components/ui/` are shadcn;
   add new ones via the CLI, don't hand-roll.
2. **Tailwind cannot generate runtime-computed class names** (`ml-${n}` never
   applies) — use inline `style={{}}` for dynamic values.
3. **Radix `asChild` children must spread props** — wrapper components must
   `{...props}` the underlying element or handlers never attach.
4. One `use-<thing>.ts` hook per component holding its business logic; scenes
   stay presentational.
5. **tanstack-query** for all API interaction; **tanstack-form** for form
   state and validation.
6. kebab-case filenames; style logic lives next to the component that uses it.

## Backend conventions

1. **Kysely, no camelCase plugin** — all tables use literal quoted camelCase
   columns. Migration column names MUST match the TS interface in
   `src/plugins/db.ts` exactly.
2. Kysely gotchas learned the hard way:
   - `.onConflict().doUpdateSet()` has no `.returningAll()` — select the row
     back after the write.
   - `where(col, "is", value)` compiles to invalid SQL for non-null values —
     use `=` for values, `"is"` only for literal null.
   - Raw SQL runs via `sql`...`.execute(db)`, not `db.executeQuery()`.
   - `.executeTakeFirst()` returns `T | undefined`.
3. `pnpm --filter @twodb/server start` runs tsx **without watch** — after
   server edits, kill the :3001 process and restart, or you'll debug stale
   code.

## LLM layer

- `lib/llm-providers.ts` is the single declarative registry: fields the
  connection form renders, the chat wire (`anthropic` | `openai` | `responses`),
  auth mode (`x-api-key` | `bearer` | `claude-oauth`), default base URL, and a
  static fallback model list. **Adding a provider = one registry entry**; the
  UI and model refresh pick it up automatically.
- `lib/agent.ts` implements the three wires with streaming rounds (text deltas,
  tool calls, usage). `lib/token-refresh.ts` handles OAuth exchange for
  claude-code/codex and persists refreshed tokens.
- Model lists refresh live when the provider supports `/models`; static lists
  are the fallback and are fine to keep minimal.

## Key subsystems

- **Agent chat** (`routes/code-ws.ts`, `lib/agent-loop.ts`) — tool-use rounds
  against runner sessions.
- **Assistant** (`routes/assistant-ws.ts`, `lib/agent/assistant-loop.ts`) —
  canvas/artifact chat, shares the model registry.
- **Notes** (`lib/notes-tables.ts`, `routes/notes*.ts`) — sections/folders/
  groups in Postgres; each group gets a dynamic physical table
  (`notes_<hex>`) with typed property columns; display metadata + views live
  in `note_group.metadata` jsonb.
- **Storage** (`lib/storage/`) — s3/MinIO and local-block drivers behind one
  registry.
- **Runners** (`lib/runner-manager.ts`, `routes/runner-ws.ts`) — outbound WS,
  terminal + job execution.

## Commands

- `pnpm local` — desktop (:5173) + server (:3001) in parallel.
- `pnpm --filter @twodb/desktop dev|tauri:dev|build` — vite / Tauri shell.
- `pnpm --filter @twodb/server dev|start` — server (schema auto-ensured on boot).
- `pnpm --filter @twodb/runner dev` — runner agent.
- `pnpm db:up` / `db:down` — postgres + memgraph via `docker-compose.db.yaml`.
- `pnpm build` — turbo; every `build` runs `tsc --noEmit` first — keep it green.
