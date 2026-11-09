# tools/

Repo-maintenance scripts, not published packages.

- `scaffold-app.mjs` — stamps the doc trio (AGENTS.md/README.md placeholder,
  manifest.ts/messages.ts/scripts/gen-docs.ts) for every app that hasn't
  been fully built out yet. Safe to re-run — never overwrites a file that
  already exists, so once an app starts getting real content this script
  leaves it alone. Run with `node tools/scaffold-app.mjs`.
