# AGENTS.md — TwoRoute webapp

TwoRoute's UI: manage space-scoped LLM provider connections. Read the root
`blocks/CONVENTIONS.md` first — same rules as the TwoDB webapp:

- One component per file; `partials/` = dumb/presentational; `hooks/` = all
  business logic; a component only calls its holding hook.

## SSO
No login lives here. Identity is the shared control-plane better-auth session
(same origin through the gateway). `RequireAuth` checks it and bounces to the
control plane's login when absent.

## API surface
- `/tworoute-api/*` → gateway `/apps/tworoute/*` (identity forwarded as
  `x-twodb-*` headers by TwoDB — never talk to better-auth or workspace
  tables here, per the backend AGENTS.md boundary).
- `/registry/spaces` → control plane (space selector data).
- Dev port 6513 (6500–6512 are taken; webapps own the 65XX band, see the
  catalog's port map).
