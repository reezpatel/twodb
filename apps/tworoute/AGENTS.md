# AGENTS.md — TwoRoute

Read `README.md` first, then `ENDPOINTS.md` (generated — `pnpm gen:docs`).

## Boundaries
- Never talk to better-auth or the org/workspace/space tables directly —
  identity arrives pre-resolved via `x-twodb-*` headers (`gateway-context.ts`).
  If you need a new piece of identity info, add it to the header contract in
  `apps/twodb/src/gateway/proxy.ts` first.
- New provider → add a `providers/<name>.ts` implementing `LlmProvider`,
  register it in `providers/index.ts`. Keep the interface to one method
  (`streamCompletion`) — don't grow a second code path for non-streaming.
- Postgres schema lives entirely in `db/schema.ts`/`db/repository.ts` — this
  app owns its own `tworoute` schema, provisioned by TwoDB, accessed only
  via `@twodb/core-data/db`'s runtime client.

## Before adding usage tracking / billing
This is explicitly deferred (see README). When you do add it: model it as
`core-async` jobs/events (e.g. a `usage.recorded` broadcast event + a
`core-data` table), not inline synchronous DB writes on the hot streaming
path.
