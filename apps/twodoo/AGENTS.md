# AGENTS.md — TwoDoo

Tasks & habits (TickTick-style). **Implemented (v1)** — read `README.md` first.

## Before writing any route
- Add a `defineEndpoint(...)` to `src/manifest.ts` first (request/response
  Zod schemas + description) — this is the single source of truth
  `ENDPOINTS.md`/`endpoint.json` are generated from. Write the Fastify
  route to match it, not the other way around. Run `pnpm gen:docs` after.
- This app only ever talks to other apps **through the Gateway**
  (`apps/twodb`) — never import `@twodb/core-platform/transport` or dial
  another app's URL directly.
- Identity arrives pre-resolved as `x-twodb-*` headers forwarded by the
  Gateway (see `src/gateway-context.ts`) — never talk to better-auth or the
  org/workspace/space tables yourself. Space scoping: repo functions take
  `{ workspaceId, spaceIds }`; empty spaceIds = all spaces.
- One Postgres schema, named `twodoo`, provisioned by TwoDB
  (the control plane (`GET /registry/config`, via twodb-core)) — access it only via
  `@twodb/core-data/db`'s `createPgDb()`.
- Call `registerWithGateway(manifest, opts)` from `@twodb/core-platform/manifest`
  on boot (see `src/index.ts`).

## Data model invariants
- Boards nest only within one space (parent_board_id cycle-guarded in the repo).
- Lists belong to exactly one board; tasks to one list (parent_task_id for subtrees).
- Completing a recurring task spawns the next occurrence (see
  `src/recurrence.ts`); completed instances remain as history.
- `recurrence_rule` is an RRULE subset: FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL;
  BYDAY;COUNT;UNTIL. The webapp quick-add parser produces the same format.

## Frontend
Follow `blocks/CONVENTIONS.md` exactly: one component per file,
`partials/` = dumb UI only, `hooks/` = all business logic with one holding
hook per component (`hooks/useTwoDoo.tsx`). Rich text: `@twodb/editor`
(RichTextEditor with `value`/`onBlur` — auto-syncs on task switch).
Known quirk on this dev box: a cross-file `import type { Priority } from
"./twoodoo-client"` in `src/lib/quick-add.ts` trips a tsc resolution bug —
the type is intentionally duplicated there; keep both in sync.

## Messaging
`src/messages.ts` is empty (no jobs/events yet). If reminders/notifications
land, declare them via `@twodb/core-async/registry` — Postgres-backed only.
