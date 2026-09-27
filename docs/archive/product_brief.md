# twodb — Product Brief

_Last updated: grounded in the current codebase (`apps/`, `plugins/`, `packages/`), `PRODUCT.md`, `DESIGN.md`, and `tasks/node-fleet.md`._

## 1. One-liner

**twodb is a second brain for people who are not technical** — one product that captures your knowledge, connects it, automates routine work, chats with you about your own data, and builds small tools for you, without ever exposing a developer surface.

## 2. Audience

Primary users are **non-technical professionals**: doctors, clinic staff, business owners, daily-wage workers. Low digital-literacy barrier is a hard requirement — plain language over jargon, forgiving interactions, generous legibility. The running product narrative (visible in mocks) is a small clinic: Dr. Asha Verma's ward rounds, stock orders, invoices, and patient follow-ups.

## 3. Positioning

Neighboring tools each own one slice and assume technical comfort:

| Tool | Slice | Gap twodb fills |
| --- | --- | --- |
| Notion | docs | no real automation or AI agency |
| Obsidian | linked notes | plugin-technical |
| n8n | automation | node-graph-technical |
| opencode | app building | developer-only |

twodb's claim none of them can copy: **the full second-brain stack — capture, connect, automate, chat, build — designed for non-technical users from day one.**

## 4. Product principles

1. **Non-technical first.** If a doctor or shop owner can't do it without help, the feature isn't done.
2. **One brain, many skills.** Notes, calendar, chat, meetings, automation, and apps share the same data and event fabric; nothing lives in a silo.
3. **Calm capability.** Power reveals progressively; default surfaces stay simple and quiet.
4. **Open by default.** No premature commitments — technical or brand — until real usage demands them.

## 5. The product surface today

The app is a thin shell (`apps/web`) with a navigation rail; every capability ships as a **plugin** (`plugins/<name>`) with a React `view/` half and a Fastify `service/` half. Status legend: ✅ working end-to-end · 🔌 backend real, UI mock/partial · 🧪 mock scene only.

### Core platform ✅

- **Identity & tenancy** (`plugins/identity`) — organizations, workspaces, sessions, and a global auth hook gating `/api/v1/*`. Every plugin declares permissions + role defaults (manager/member); every row is `workspace_id`-scoped.
- **Design system** (`packages/ui`) — "Cyclorama Dawn": two phases (day/night) over one semantic token set, flat cobalt action, rose reserved for AI presence, hairlines instead of shadows. Consumed as source; plain CSS custom properties, no Tailwind.
- **Event fabric** (`packages/shared-backend`, `@twodb/contracts`) — a typed in-process bus; cross-plugin communication is event-first (`<plugin_id>.<noun>.<verb-past>`), with contracts shared as pure types between both halves.

### Knowledge & content

- **Content** (`plugins/content`) 🔌 — Notion-like structured content: trees, sections, rows, columns, and views. The notes/docs/database backbone.
- **Files & storage** (`plugins/storage`) 🔌 — storage locations, folders, and files over S3-compatible object storage (MinIO in dev). Files scene 🧪 exists in the shell.

### Time & communication

- **Calendar** (`plugins/calendar`) 🔌 — local calendars plus Google / Microsoft / CalDAV / ICS connectors, encrypted credentials, recurring events, attendees, reminders, sync cursors. Rich month/week/day/list scene 🧪.
- **Chat** (`plugins/chat`) ✅ — conversations, messages, reactions, read state, message actions; emits bus events for realtime fan-out.
- **Meetings** (`plugins/meetings`) 🔌 — meetings with participants, **multiple recordings per meeting** (audio/video/screen, lifecycle-tracked, storage-key ready), append-only transcript segments with speaker/language/offsets, and 1:1 AI summaries (overview, key points, action items). Live-scribe scene 🧪 (stage, AI scribe, participants, summary/transcript tabs). Status transitions (`scheduled → live → ended/cancelled`) are guarded; everything emits typed events.
- **Email** 🧪 and **Inbox** 🧪 — shell scenes, service not yet built.

### Intelligence & execution

- **Agent** (`plugins/agent`) ✅ — user-configurable AI agents with credentials, threads over the pi agent runtime, and usage tracking. This is the "chat with your data / act on your data" layer.
- **Automations** 🧪 — shell scene; the n8n-for-normal-people surface, not yet a plugin.
- **Code** (`plugins/code`) 🔌 — repositories and execution sessions; the seed of the AI app builder.
- **Node fleet** (`plugins/node`, `apps/node`) ✅ — child agents that register with the controller over a WebSocket gateway, authenticate with per-node secrets, and stream heartbeats with resource stats. Nodes play three roles (per README): **StorageProvider**, **ExecutionProvider**, **JobProvider** (serverless job runners) — the distributed backbone for storage, code execution, and automation jobs.

## 6. Architecture in one paragraph

Turborepo + pnpm monorepo. `apps/web` (React/Vite, :5173) is a plugin host — views register routes via `react-pluggable`. `apps/api` (Fastify, :3001) mounts each service plugin under `/api/v1/<plugin_id>`; services never hardcode prefixes. Each plugin owns a namespaced Postgres schema (`io_twodb_<name>`) migrated at boot via Kysely, shares DTOs/event maps through `@twodb/contracts`, and talks to other plugins over the typed bus rather than by import. Memgraph sits beside Postgres for linked-knowledge graph work. Styling is inline → styled-jsx sibling files → design tokens, in that order of escalation.

## 7. Design language (binding)

Calm UI, slightly condensed density, protected negative space, **no glow, no heavy shadows** (user-pinned). Light is the only chrome: cobalt = structure/action, rose = AI presence (The Two Lights Rule). One solid control per view. Dialogs own the only shadow. IBM Plex Sans tracked caps for cue labels; Outfit for everything else; tabular numerals for live data. Closest reference: Notion.

## 8. Tenancy, security & data model commitments

- Workspace-scoped everything; a `requireWorkspace` gate per route, 401/403 before any data access.
- Per-plugin permission claims with role defaults, declared in each service manifest.
- Provider credentials (calendar) stored AES-GCM-encrypted; node secrets shown once at creation.
- Migrations are boot-time, per-plugin, idempotent — plugins can be added without touching core.

## 9. Roadmap

### Now — make the real backends visible

1. **Wire meetings view to the service** (tanstack-query): the live-scribe mock's scripted transcript becomes an SSE subscription to `io.twodb.meetings.transcript.appended`.
2. **Meeting artifacts into storage**: `mt_recordings.storage_key` + presigned uploads via `plugins/storage`.
3. **Calendar → meetings**: auto-schedule a meeting when a calendar event with a `conferencing_url` starts (bus subscription).
4. **Node fleet UI** (per `tasks/node-fleet.md`): fleet dashboard, liveness polling, secret-once creation flow; containerize `apps/node`.

### Next — close the loop on the second brain

1. **Action items → content**: meeting summary action items emitted into `plugins/content` as trackable rows.
2. **Transcript search**: workspace-wide search across transcripts, notes, and chat — the "recall effortlessly" promise.
3. **Inbox & email services**: unify notifications (meeting ended, summary ready, automation ran) into the Inbox scene.
4. **Automations plugin**: plain-language rules ("every Friday, remind me about unpaid invoices") compiled to jobs running on the node fleet's JobProvider role.

### Later — the differentiators

1. **AI app builder**: agent + code plugins generate small purpose-built apps (the opencode-for-non-developers claim).
2. **Linked knowledge graph**: Memgraph-backed backlinks across notes, meetings, people, and events.
3. **Meetings trust layer**: retention policies (`retention_days`), consent capture, per-participant recording disclosure — essential for the clinic scenario.

## 10. Success looks like

A non-technical user dumps their thinking into twodb — a note, a meeting, a photo of an invoice — finds it again effortlessly, and has the product **act** on it: reminding, summarizing, automating, answering, and building — without ever touching a developer tool.

## 11. Open questions

- Realtime transport: the bus fan-out SSE endpoint is stubbed (`apps/api/src/index.ts` comments); pick the transport before wiring live scenes.
- Claims enforcement: permission claims are declared but the `requireClaim` enforcement decorators are commented out — decide when RBAC becomes blocking.
- Email: build a full mail service or a connector model like calendar's?
- Multi-node job scheduling semantics (fairness, placement) as the fleet grows.
