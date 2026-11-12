# TwoThing

Personal inventory for makers: electronics, computer parts, cables, hardware &
fasteners, tools, art & craft, 3D printing, consumables. **Status: implemented.**

Shape: `backend+webapp` · API docs: [`ENDPOINTS.md`](./ENDPOINTS.md) (generated from `src/manifest.ts`)

## What it does

| | |
|---|---|
| **Places** | Nested tree (Room › Shelf › Drawer › Box …), 10 kinds, counts incl. nested, move/re-parent with cycle protection, delete re-homes contents one level up. |
| **Items** | Category-specific spec templates (e.g. electronics → Value/Package/Voltage…), quantity + unit + low-stock threshold, tags, photos (client-downscaled), sourcing (MPN, supplier, cost, buy-again + datasheet links), stars, notes. Grid/list views, multi-term search over everything, bulk move / bulk label print. |
| **Labels** | Bulk-generate random 6-char codes (`K7Q-M2X`, Crockford base32 minus I/L/O/U ≈ 1.07 B combos). A code is **never** issued if it was generated in the last 7 days or is on any item/place. Print on A4/Letter sheets (65/40/24/14/30-up) or thermal rolls (incl. Brother QL 62×29); skip used positions on a partial sheet; QR = bare code or a deep link phone cameras open. Batches are kept for reprinting the unused ones. |
| **Scanning** | Full-screen camera scanner (native `BarcodeDetector`, ZXing-WASM fallback for iOS/Firefox/desktop), torch + camera switch. Modes: **Find**, **Put away** (scan a box, then the things going in it), **+1 In**, **−1 Out**. Reads our labels *and* manufacturer EAN/UPC/Code-128/QR/DataMatrix. USB/Bluetooth "keyboard wedge" scanners work anywhere in the app. Every form field that takes a code has a Scan button. |
| **Rest** | Dashboard (stats, low stock, categories, recent, starred, activity), full activity log, CSV export/import (round-trips), keyboard shortcuts (`S` scan, `N` new item, `/` or `⌘K` search). |

## Layout

```
src/
  manifest.ts          endpoint contracts (source of ENDPOINTS.md)
  server.ts, index.ts  Fastify app + gateway registration
  db/schema.ts         tt_location, tt_item, tt_code, tt_code_batch, tt_image, tt_activity
  lib/codes.ts         alphabet, normalize (look-alikes, TT: prefix, /c/CODE deep links)
  lib/code-pool.ts     bulk allocator (advisory-locked; 7-day + used exclusion)  ← tested
  lib/items.ts, locations.ts, activity.ts, csv.ts
  routes/*.ts
webapp/src/
  scanner/             camera + wedge hooks, scan session (modes), overlay
  items/ places/ labels/ dashboard/ activity/ settings/ resolve/
  pickers/             place picker dialog (search / tree / scan)
  ui/                  shared presentational pieces (QtyStepper, MatchCard, …)
  lib/                 api client, tiny SWR cache, hash router, catalog, qr, toast
```

## Dev

```bash
# once: schema + least-privilege role (prints TWOTHING_DATABASE_URL / _PROVISION_TOKEN for .env)
pnpm --filter @twodb/app-twodb provision:dev twothing

# through the Gateway (real SSO), like every other app
pnpm --filter @twodb/app-twothing dev
pnpm --filter @twodb/app-twothing-webapp dev          # https://<host>:6504 when DEV_HTTPS=true

# standalone, no Gateway: dev identity fallback + direct proxy, no login
TWOTHING_DEV_WORKSPACE=me pnpm --filter @twodb/app-twothing dev
TWOTHING_DIRECT=1 pnpm --filter @twodb/app-twothing-webapp dev

pnpm --filter @twodb/app-twothing test                # code-pool integration tests (dev Postgres)
pnpm --filter @twodb/app-twothing gen:docs            # after touching src/manifest.ts
```

Camera access needs a secure context: `localhost` works; from a phone on the
LAN use `DEV_HTTPS=true` (mkcert certs in `.dev-certs/`).

## Notes / limits
- Unused codes older than 7 days can be re-issued — throw away old unused sheets
  (or reprint from the batch page) rather than mixing them with new ones.
- Images live in Postgres (`tt_image`, ≤ 8 MB, downscaled to ~1600 px WebP by
  the client). Moving them to TwoDrive's app-file API is a drop-in later.
- Currency display is USD-formatted; the number itself is unitless.
