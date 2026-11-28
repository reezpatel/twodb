# TwoPager

Static-site hosting for landing pages — and the gateway's **catch-all service**. A *site* belongs to a space and has
*versions* (one is live, Firebase-Hosting style). Files live in S3, records in Postgres, and requests are served from a
local disk cache.

```
custom domain ──► gateway (CATCH_ALL_SERVICE=twopager) ──► TwoPager ──► site by Host ──► active version ──► file
twopager.<ROOT_DOMAIN> ─► admin UI (webapp)           /api/*  ─► admin API (session / API key)
```

## Model
| thing | notes |
|-------|-------|
| **site** | `space_id`, unique `slug`, `active_version_id`, custom `domains` (globally unique), optional built-in host `<slug>.<SITES_DOMAIN>` |
| **version** | numbered per site; `draft` (editable) → `final` (immutable). Exactly one is *active*. Rollback = activate an older one |
| **file** | path → sha256 blob. Blobs are content-addressed (`sites/<siteId>/<sha256>` in S3) and shared between versions, so cloning a version is cheap |

## Agent workflows
```bash
# 1. whole site from a zip (a wrapping folder is stripped; twopager.json at the root = config). Goes live unless activate=false.
curl -X POST "$GW/apps/twopager/api/sites/$SITE/versions/zip?message=launch" -H "x-api-key: $KEY" \
     -H "content-type: application/zip" --data-binary @site.zip
#    (or JSON: {"zipBase64": "...", "activate": true})

# 2. add/replace pages on top of the live site, in one call (clone active → write → finalize → activate)
POST /sites/:id/pages   {"pages":[{"path":"pricing/index.html","content":"<h1>…</h1>"}], "message":"add pricing"}

# 3. staged: draft → files → config → finalize
POST /sites/:id/versions {"fromActive":true}      PUT /sites/:id/versions/:v/files {"files":[…]}
PUT  /sites/:id/versions/:v/config {"config":{…}} POST /sites/:id/versions/:v/finalize {"activate":true}
```
Binary files: `contentBase64`. Read back with `GET …/versions/:v/file?path=…`; roll back with `POST /sites/:id/activate`.

## Serving rules (per version config / `twopager.json`)
Order: **redirects → static file → rewrites → 404 page** (`404.html` by default, status 404).
```json
{
  "spa": true,
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [{ "source": "/old/:slug", "destination": "/blog/:slug", "type": 301 }],
  "rewrites":  [{ "source": "/app/**",   "destination": "/index.html" }],
  "headers":   [{ "source": "**/*.js",   "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }],
  "notFoundPage": "404.html"
}
```
Globs: `**` any depth · `*` within a segment · `?` · `{a,b}` · `:name` one segment (usable in redirect destinations).
`spa: true` appends `** → /index.html`. Real files always win over rewrites. Directory paths serve `index.html`.
Default `Cache-Control`: HTML `max-age=0, must-revalidate`, everything else 1 h; ETag = content hash (304 supported).

## How host routing works
* The gateway sends hosts outside `ROOT_DOMAIN` here (`CATCH_ALL_SERVICE=twopager`, IPs/localhost/single-label hosts excluded) and
  forwards the original host as `x-forwarded-host` (always overwritten by the gateway).
* TwoPager treats `ADMIN_HOSTS` (+ localhost, IPs, single-label names) as the admin UI; **any other host** is looked up in
  `site_domain` (or `<slug>.<SITES_DOMAIN>`) and served from the site's active version. Unknown host → 404 page.
* Sites are served for `GET`/`HEAD` only, and not under `/api`, `/_svc` or `/healthz` (the gateway reserves those paths).

## Caching
* Host → active version pointer: in memory, 10 s TTL, dropped immediately on local changes (activation made on another replica shows within ~10 s).
* Versions (file map + config): in memory, immutable once final (LRU of 100).
* Blobs: local disk cache `CACHE_DIR`, filled from S3 on first hit, LRU-evicted above `CACHE_MAX_MB`.

## Config (env)
`CACHE_DIR` · `CACHE_MAX_MB` (2048) · `ADMIN_HOSTS` · `SITES_DOMAIN` (must not be under `ROOT_DOMAIN`) · `MAX_ZIP_MB` (1024; expanded limit 5×)
· `MAX_FILE_MB` (512) · `MAX_FILES` (5000). Site blobs live in the control plane's S3 bucket (mandatory — TwoPager refuses to boot without it).
The gateway buffers request bodies up to `TWODB_BODY_LIMIT_MB` (4096).

## Dev
`pnpm --filter @twodb/app-twopager dev` (port 6420) · webapp `pnpm --filter @twodb/app-twopager-webapp dev` (port 6522) ·
`pnpm --filter @twodb/app-twopager test` · e2e: `TEST_DATABASE_URL=postgres://… tsx scripts/smoke.ts`.
To try a site locally, call the app with a `Host` header, e.g. `curl -H 'x-forwarded-host: landing.acme.com' localhost:6420/`.

## Limits worth knowing
* Domain ownership is not verified (first come, first served; one site per domain). Put DNS/TLS in front deliberately.
* No server-side form handling; static only. Paths `/api/*` and `/_svc/*` on a site host are not reachable.
