# AGENTS.md — @twodb/core-graph

- Keep this package to a thin wrapper. Query-building/business logic (e.g.
  "find mutual contacts") belongs in the consuming app, not here.
- Always namespace labels/relationship-types via `ns()` — never hardcode a
  bare label, since Memgraph is a shared instance across apps.
- Don't add a hard dependency on this package from `core-data` or any app
  that doesn't need graph queries — it stays strictly opt-in.
