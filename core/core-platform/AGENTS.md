# AGENTS.md — @twodb/core-platform

Read `README.md` first.

## Boundaries
- `manifest` is the only place that converts Zod schemas to JSON Schema /
  markdown. If an app needs custom doc formatting, extend the generator
  here (so every app benefits), don't hand-roll a second generator.
- `auth` — the org/workspace/space tables and better-auth engine are owned
  and run by `apps/twodb` alone. Do not add a second app that imports
  `engine.ts`/`schema.ts` directly; other apps consume identity only via
  the `AuthContext` the Gateway forwards (see `apps/twodb/ENDPOINTS.md` for
  the header contract).
- `transport` must never become a dependency of a non-TwoDB app. If you
  find yourself importing this from `apps/twomail` or similar, stop — that
  app should be calling the Gateway over HTTP instead.
- `telemetry` stays intentionally tiny. Don't wire in a real metrics
  backend speculatively — wait until an app needs it and extend here once,
  for everyone.

## When changing `auth`
- Keep `emailAndPassword: { enabled: false }` — passwordless is a product
  decision, not an oversight.
- API keys are workspace-scoped only, never space-scoped — don't add
  `spaceIds` to the API key table. Only interactive sessions carry
  `spaceIds` (see `context.ts`).
- A user has implicit access to every Space in a Workspace they're a member
  of — there is intentionally no `space_member` table. Don't add one without
  revisiting the decision log in the architecture plan first.
