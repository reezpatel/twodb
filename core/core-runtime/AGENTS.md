# AGENTS.md — @twodb/core-runtime

## Boundaries
- Keep `cli/` and `shell/` fully independent of each other — no cross
  imports. They ship as separate subpath exports for a reason (one is
  Node-only, the other is browser-only).
- `cli/types.ts` duplicates the `endpoint.json` shape on purpose instead of
  importing `@twodb/core-platform/manifest` — this is a wire contract
  between the CLI and whatever the Gateway serves, not a code dependency.
  If the shape changes, update both sides deliberately.

## When touching `shell/`
- Follow the partials/hooks convention here exactly like any app would:
  new business logic → a hook under `hooks/`; new presentational pieces →
  `partials/`. `useShell` is the one holding hook `Shell.tsx` is allowed to
  call directly.
- `PaneStateStore` must stay a two-method contract (`load`/`save`). Don't
  leak localStorage- or DB-specific concerns into `types.ts` — that belongs
  in `persistence/*`.

## When touching `cli/`
- New endpoint auth modes must be reflected in both `registry-client.ts`
  (`authHeaders`) and documented in TwoDB's own `ENDPOINTS.md` header
  contract.
