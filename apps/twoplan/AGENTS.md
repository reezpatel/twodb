# AGENTS.md — TwoPlan
- Declare every endpoint with `route()` (src/lib/route.ts) in src/routes/*; the manifest derives from `allRoutes`. Run `pnpm gen:docs` after changes.
- Access: always resolve via `resolveProject`/`resolveTicket` (workspace-scoped). Never query by bare id.
- Webapp follows blocks/CONVENTIONS.md: holding hook per page (`use*Page.ts`), dumb partials.
- Gateway change: `GET /apps/<slug>/public/<token>` is proxied anonymously (share links); x-twodb-* headers from callers are stripped.
