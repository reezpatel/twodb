# AGENTS.md — TwoPager
- Declare every endpoint with `route()` (src/lib/route.ts) in src/routes/*; the manifest derives from `allRoutes`. Run `pnpm gen:docs` after changes.
- Admin API is workspace + space scoped (`loadSite` checks both). Site *serving* (src/engine/serve.ts) is anonymous and keyed by Host only — never add auth-dependent behavior there.
- Versions are immutable once `final`; mutate only drafts (`loadDraft`). Blobs are content-addressed per site; delete via `Blobs.gc` so shared blobs survive.
- The serving decision is the pure `resolveRequest()` (src/engine/match.ts) — extend it with tests in match.test.ts, not in the HTTP layer.
- `rewriteUrl` in server.ts decides admin-vs-site by Host (`createAdminHostCheck`); the gateway supplies `x-forwarded-host`.
- Webapp follows blocks/CONVENTIONS.md: holding hook per page (`hooks/use*Page.ts`), dumb partials.
