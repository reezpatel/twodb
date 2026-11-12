# TwoPin

Pinterest-style link boards. **Status: implemented (v1).** Save URLs to boards;
TwoPin fetches each link's metadata server-side — title, description, site name,
preview image (og:image) and favicon — and stores the image bytes in its own
Postgres schema so the UI never hotlinks third-party origins.

Shape: `backend+webapp`

## Backend (`src/`)
- Fastify server; every route (except `/healthz` + the internal manifest
  endpoint) requires the Gateway-forwarded `x-twodb-*` identity headers.
- `src/lib/link-metadata.ts` — the fetcher: bounded fetch (timeouts, byte caps,
  max 5 redirects), SSRF guard (http/https only, private/loopback IPs refused,
  redirect hops re-validated), cheerio-based OG/Twitter/meta extraction,
  best-effort image + favicon download.
- `src/db/schema.ts` — `board` and `pin` tables (pins cascade-delete with their
  board; image/favicon stored as bytea, served via `/pins/:id/image` and
  `/pins/:id/favicon`).
- Endpoints are declared in `src/manifest.ts` (source of truth) — run
  `pnpm gen:docs` after changing them.

## Webapp (`webapp/`)
Boards sidebar + masonry pin grid, add-pin dialog with live URL preview
(`POST /metadata/preview`), edit/move/refresh/delete per pin. Follows
`blocks/CONVENTIONS.md` (partials/hooks split).

## Dev
```sh
pnpm --filter @twodb/app-twodb provision:dev twopin   # one-time: DB creds → .env
pnpm --filter @twodb/app-twopin dev                   # backend on :6415
pnpm --filter @twodb/app-twopin-webapp dev            # webapp on :6510 (proxies /apps/twopin → gateway)
```
