# TwoPlan

Project management: **Space → Project (KEY) → epics / milestones / tickets**. UX modeled on
[itsaplan](https://github.com/croffasia/itsaplan) (AGPL-3.0, see LICENSE-NOTICE.md); UI built on `@twodb/blocks`,
rich text on `@twodb/editor`. Access is workspace-level (no per-project roles).

- Backend: Fastify + Kysely, schema `twoplan`, port 6417. Endpoints: `ENDPOINTS.md` (generated, `pnpm gen:docs`).
- Webapp: Vite on 6516 (`pnpm --filter @twodb/app-twoplan-webapp dev`), proxies `/twoplan-api` → gateway `/apps/twoplan`.
- Mapping: issue→ticket, initiative→epic, cycle→milestone (time-boxed).
- Views: list (grouped), board (drag & drop), timeline. Saved views, filters in URL.
- Also: sub-tasks, checklists, links, attachments, custom fields, estimates, watchers/inbox, docs/notes, dashboards,
  ticket + project templates, CSV/Linear import, CSV/JSON export, public share links, git dev links (manual).
- Not included: AI, automation, webhooks, realtime, MCP, worklogs, calendar view, swimlanes.

Dev: `pnpm db:up`, run twodb gateway, then `pnpm --filter @twodb/app-twoplan dev`.
