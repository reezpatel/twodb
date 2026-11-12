# TwoDrive

Drive/file explorer over multiple storage backends. **Status: implemented (v1).**

Shape: `backend+webapp` (backend :6406, webapp :6512)

## What it does
- **Backends**: register any number of storage backends — S3-compatible
  (AWS/MinIO/R2) or local filesystem paths. Secrets encrypted at rest
  (AES-256-GCM via `TWODB_DATA_KEY`).
- **Virtual storages**: soft "buckets" carved out of a backend (a prefix).
  Each appears as its own sidebar entry. Browsable like a drive.
- **Explorer**: upload/download, mkdir, rename, move, copy, search, recent,
  list/grid views, image thumbnails in grid view — modeled on the legacy
  monolith's files scene.
- **Trash**: soft delete with restore, purge, empty-trash.
- **Share links**: public token URLs for files (revocable, optional expiry).
- **Internal app API** (`/app/objects/...`): other apps put/get/patch/list
  their files with a friendly `x-twodb-app` header. Each app gets a
  dedicated `<appId>/` folder inside the workspace's **default virtual
  storage** (or a per-app override). No default + no override → `409
  no_default_storage`.
- **S3-compatible surface** (`/s3/:storageId/...`): per-virtual-storage
  access keys with **simplified auth** (`x-amz-access-key-id` +
  `x-amz-secret` headers or `Authorization: AWS id:secret`) — NOT SigV4,
  so real S3 clients won't work against it; it's for internal scripts.
  Ops: GET bucket (list), GET/HEAD/PUT/DELETE object.

## Layout
- `src/manifest.ts` — every endpoint (source of truth for ENDPOINTS.md)
- `src/db/schema.ts` — 6 tables: backends, virtual storages, entries
  (the central file table — source of truth), app overrides, access keys,
  share links
- `src/storage/` — drivers (S3 + local) + cached registry, ported from the
  legacy monolith (`archive/apps/server/src/lib/storage`)
- `src/lib/store.ts` — entry tracking + all file operations
- `src/routes/` — backends/storages, explorer, app API, S3 surface, shares
- `webapp/src/drive/` — sidebar tree (backend → virtual storages), files
  scene, trash, settings (backend forms, default storage, app overrides,
  access keys)

## Dev
```
pnpm --filter @twodb/app-twodb provision:dev twodrive   # once: DB + token into .env
pnpm --filter @twodb/app-twodrive dev                   # backend :6406
pnpm --filter @twodb/app-twodrive-webapp dev            # webapp :6512 (proxies gateway)
```
The webapp talks to the backend through the Gateway (`/apps/twodrive/...`),
so TwoDB must be running and TwoDrive registered for the UI to have data.

## Known gaps / next
- S3 surface is simplified-auth only (no SigV4, no multipart) — real S3
  clients (aws cli, rclone) can't use it yet.
- Folder downloads don't zip; share links are file-only in v1.
- No quotas (usage display only), no background sync/rescan of backends —
  the central table is the sole source of truth (writes must go through
  TwoDrive APIs).
- Preview is thumbnail-only (grid view images); no in-app viewers yet.
