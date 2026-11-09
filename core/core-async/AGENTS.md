# AGENTS.md — @twodb/core-async

## Boundaries
- `engine/` stays generic — do not add app-specific job types or payload
  validation here. That belongs in the consuming app's `src/messages.ts`
  using `registry/`.
- Don't swap the Postgres-backed implementation for Redis/NATS without
  revisiting the architecture decision log first (v1 is intentionally
  Postgres-only, including for latency-sensitive apps like TwoChat/TwoRing).
- Keep broadcast payloads tiny by convention in every app's `messages.ts` —
  this package doesn't enforce a size limit in code (Postgres NOTIFY does,
  at ~8KB), but reviewers should push back on large payloads.

## When adding a feature
- New engine capability (e.g. scheduled/cron jobs) → add to `engine/index.ts`,
  keep the public surface (`queue`, `broadcast`) small and composable.
- New documentation need → extend `registry/generate.ts`, not a one-off
  script in some app.
