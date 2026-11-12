# Paintress

Miro-like boards where **a human edits in the browser while LLM agents edit through the REST API**, on the same board, live.

| Board kind | What it is | Built on |
|---|---|---|
| `diagram` | Infinite canvas for **architecture (incl. C4), AWS / Google Cloud, ERD, flowcharts, swimlane process maps** — plus sticky notes, text and images | React Flow (`@xyflow/react`) |
| `doc` | **Markdown** document; ```` ```mermaid ```` fences render as diagrams | CodeMirror + react-markdown + mermaid |

Shape: `backend+webapp` · API port `6414` · webapp port `6507`

## What you get
- **Live sync over WebSocket** (`GET /boards/:id/ws`). Every committed change is NOTIFY'd through Postgres; each process LISTENs and pushes to its sockets. Reconnects resume from the last `seq`.
- **Undo/redo that includes agent edits.** Each change is one batch with server-computed inverse ops; the browser's Ctrl+Z applies them. An agent's whole build is one undo step labelled e.g. "AI: AWS 3-tier".
- **Agents describe, the server lays out.** `POST /boards/:id/diagram | erd | process | mermaid` take a graph and place everything with ELK (nested groups, right-angle edges, swimlanes). Items are matched by `key`, so re-calling updates in place; anything the human moved by hand is *pinned* and left alone.
- **Real diagram building blocks:** ERD tables whose *rows* are connection points with crow's-foot cardinality; AWS / GCP / C4 nestable containers; 60+ flowchart / BPMN / C4 / basic shapes; swimlane pools and lanes; ~4,000 searchable icons (AWS + Google Cloud service icons, tech logos, generic infrastructure).
- **Doc boards for agents:** `PATCH /boards/:id/doc` with `append`, `replace_section`, `replace` — edit one section without resending the document. Stale writes are `409`; the UI offers "use theirs / keep mine".
- **Images** are stored in S3 (MinIO bucket `twodb`) under `paintress/{workspaceId}/{boardId}/{assetId}`; SVG uploads are served sandboxed.

Access: every board has `workspace_id` + `space_id`; permission is by workspace only, all members read-write.

## Agent quick start
```bash
# 1. a board
curl -X POST $GATEWAY/apps/paintress/boards -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"name":"Checkout architecture","kind":"diagram"}'

# 2. describe a diagram; positions are computed for you
curl -X POST $GATEWAY/apps/paintress/boards/$ID/diagram -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '{
  "label": "AI: checkout architecture",
  "groups": [{"key":"vpc","title":"VPC","style":"aws-vpc"}, {"key":"priv","title":"Private","style":"aws-subnet-private","parent":"vpc"}],
  "nodes":  [{"key":"web","label":"Web","icon":"logos:react"},
             {"key":"api","label":"API","icon":"logos:aws-lambda","parent":"priv"},
             {"key":"db","label":"Aurora","icon":"logos:aws-aurora","shape":"cylinder","parent":"priv"}],
  "edges":  [{"from":"web","to":"api","label":"HTTPS","step":1},{"from":"api","to":"db","label":"SQL","step":2}]}'

# 3. read it back as text, find icons, see all shapes / group styles
curl $GATEWAY/apps/paintress/boards/$ID/describe
curl "$GATEWAY/apps/paintress/icons/search?q=kafka"
curl $GATEWAY/apps/paintress/catalog
```
Full reference: `ENDPOINTS.md` (generated). Mermaid import supports `flowchart`/`graph` and `erDiagram`; for other Mermaid types use a doc board.

## Layout
```
src/
  manifest.ts        endpoints (Zod) — source of truth for ENDPOINTS.md
  server.ts          fastify wiring · routes/{boards,build,misc}.ts · ws.ts (socket) · hub.ts (LISTEN/NOTIFY fan-out)
  store.ts           applyBatch(): the ONE write path (transaction + event log + inverse + NOTIFY)
  builders/          diagram · erd · process · mermaid · relayout · describe · reconcile (merge-by-key)
  layout.ts          ELK + swimlane layout        icons.ts   bundled Iconify sets
  shared/            model.ts (items, ops, WS protocol) · shapes.ts · dto.ts — imported by the webapp too
webapp/src/          boards-list/ · board/ · board-diagram/ (nodes, edges, hooks, partials) · board-doc/
scripts/             smoke.ts (API + WebSocket e2e) · ui-check.mjs (real browser) · dev-shim.ts (UI dev without the control plane)
```

## Running it
```bash
pnpm --filter @twodb/app-twodb provision:dev paintress   # once: schema + role, prints DATABASE_URL
# put it in the root .env as PAINTRESS_DATABASE_URL=…  (PAINTRESS_PORT=6414 already there)
pnpm --filter @twodb/app-paintress dev                   # API
pnpm --filter @twodb/app-paintress-webapp dev            # UI (proxies /paintress-api → gateway → /apps/paintress)
```
Set `STORAGE=s3` to use MinIO (defaults to a local folder `./.data/blobs`). To register with the Gateway in dev, issue a token (`POST /orchestrator/apps/paintress/issue-token`) and set `TWODB_PROVISION_TOKEN`.

Without the control plane at all: `pnpm tsx scripts/dev-shim.ts` fakes session/spaces and forwards to :6414, then run the webapp with `TWODB_GATEWAY_URL=http://127.0.0.1:6499`.

## Tests
```bash
pnpm test                                   # unit: builders, mermaid, layout, client item store, flow graph
pnpm tsx scripts/smoke.ts                   # API + WebSocket end to end (server must be running)
node scripts/ui-check.mjs                   # real browser: live agent edits, undo, drag, palette, ERD/process/doc boards
```

## Not in Phase 1
Multi-human cursors / collaborative text editing (one human + agents), read-only sharing, board thumbnails, Mermaid types beyond flowchart/erDiagram on the canvas, AWS/Azure official icon packs (Iconify's AWS service icons and Google Cloud icons are used).
