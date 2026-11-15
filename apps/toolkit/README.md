# Toolkit

Central host for external MCP servers and API tool connectors. **Status: v1 in
progress.** Two surfaces:

1. **MCP** — user-registered external MCP servers (any http/sse endpoint),
   space-scoped. Ported from Artisan's MCP config (Artisan keeps its own copy
   until it migrates).
2. **Connectors** — code-owned templates (first: **Planes**, the Plane project
   manager) that users configure instances of (many per template, each with its
   own config + space scope). Each instance exposes:
   - **Commands** — execution tools other apps invoke over the API
     (`POST /apps/toolkit/api/tools/:toolId/invoke` → `{ output }`);
   - **Broadcasts** — background activity (poller) emitting events other apps
     listen to (`GET /events`, SSE at `/events/stream`, pg_notify on the
     core-async channel) or consume durably by **requesting a queue**
     (`POST /queues`, `POST /queues/:instanceId/:name/next`) — broadcasts can
     be dropped, queues can't.

Shape: `backend+webapp`. Before writing routes read `AGENTS.md`; endpoints are
declared in `src/manifest.ts` first (run `pnpm gen:docs`).
