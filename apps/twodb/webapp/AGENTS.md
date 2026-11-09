# AGENTS.md — TwoDB webapp

Admin console: passkey login, app registry, Postgres provisioning. Read the
root `blocks/CONVENTIONS.md` before adding anything here — this app follows
it exactly:

- One component per file.
- `partials/` = dumb/presentational only (`routes/*/partials/*`).
- `hooks/` = all business logic (`routes/*/hooks/*`), with one holding hook
  per component (e.g. `useAppsRegistry` composes `useAppsRegistryData` +
  `useProvisionApp`).
- A component (e.g. `AppsRegistry.tsx`) only ever calls its one holding hook
  and renders partials — never fetches data or holds state itself.

## Promotion rule
Nothing here has been promoted to `blocks` yet. The moment a second app
needs e.g. `ConnectionStringBanner`-style "show a secret once" UI, move it
to `blocks` instead of copy-pasting.

## Auth
`src/lib/auth-client.ts` mirrors the archived desktop app's pattern
(`better-auth/react` + `@better-auth/passkey/client` + `@better-auth/api-key/client`),
minus the admin/organization plugins we don't use (TwoDB has its own
org/workspace/space tables instead, not better-auth's organization plugin).
