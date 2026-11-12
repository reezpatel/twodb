# TwoDoo

Tasks & habits — TickTick-style. **Status: implemented (v1)** — boards/list/task
hierarchy with nesting, TipTap descriptions, checklists, time bounds, priority,
tags, recurrence, habit tracking with streaks/heatmaps, smart lists (Today/
Tomorrow/This Week/This Month/All/Completed), month calendar, per-list kanban,
and smart quick-add (`#tag` `@person` `!` dates `every mon`).

## Hierarchy

```
Space (from x-twodb-space-ids)
 └─ Board (nestable folder — parent_board_id, same space)
     └─ List (leaf container)
         └─ Task (subtasks via parent_task_id + checklist items)
```

- Home page = board cards grouped by space with rollup counts (open/due-today).
- Completing a recurring task spawns the next occurrence (RRULE subset in
  `src/recurrence.ts`, mirrored by the webapp quick-add parser).
- Habits: schedules (daily/weekly/interval/monthly), target counts, streak
  goals, check-in logs; heatmap + streaks computed server-side.

## Layout

- `src/manifest.ts` — every endpoint, Zod-first (single source of truth →
  ENDPOINTS.md/endpoint.json via `pnpm gen:docs`)
- `src/server.ts` — Fastify routes (gateway identity via `src/gateway-context.ts`)
- `src/db/` — schema.ts (kysely DDL, applied on boot) + repository.ts (all
  queries, smart-list ranges, streak math)
- `webapp/src/lib/quick-add.ts` — the smart parser (pure; live chips in the UI)
- `webapp/src/routes/twodoo/` — TwoDoo scene: hooks/useTwoDoo.tsx (holding hook)
  + partials/ (sidebar, home, board page, task rows, detail panel, quick-add
  bar, habits, calendar, kanban)

## Dev

```
pnpm --filter @twodb/app-twodb provision:dev twodoo   # once: writes TWODOO_* into .env
pnpm --filter @twodb/app-twodoo dev                    # backend :6416
cd webapp && TWODOO_API_TARGET=http://localhost:6416 pnpm dev   # UI :6511
```

`TWODOO_API_TARGET` bypasses the gateway for the API proxy (injects dev
identity headers). Prod always routes through the gateway (`/apps/twodoo`).
Registration: `registerWithGateway` on boot with the provision token.

## Known gaps / next

- Sub-task indentation in list view (schema supports parent_task_id; UI shows
  checklist instead).
- Drag-reorder endpoint exists; UI drag gesture not wired yet.
- Assignees: `assignee_user_id` reserved, single-user v1.
- Trash view: rows carry status=trashed via PATCH; dedicated trash browsing UI
  is minimal.
