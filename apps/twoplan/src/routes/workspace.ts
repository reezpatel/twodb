import { z } from "zod";
import { randomBytes } from "node:crypto";
import { ulid } from "ulid";
import { route, type RouteDef } from "../lib/route.js";
import { resolveProject, resolveTicket } from "../lib/access.js";
import { toApi, toApiList } from "../lib/rows.js";
import { badRequest, notFound } from "../lib/http.js";
import { hydrateTickets } from "../lib/tickets.js";
import { anyObject, anyList, ok } from "./schemas.js";

export const workspaceRoutes: RouteDef[] = [
  // ── inbox / notifications (in-app only) ─────────────────────────────────
  route({
    name: "listNotifications", method: "GET", path: "/notifications",
    description: "Caller's inbox, newest first. unread=true filters to unread.",
    request: z.object({ unread: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }),
    response: z.object({ items: anyList, unreadCount: z.number() }),
    handler: async (ctx, { unread, limit }) => {
      if (!ctx.userId) return { items: [], unreadCount: 0 };
      let q = ctx.db
        .selectFrom("notification").leftJoin("ticket", "ticket.id", "notification.ticket_id").leftJoin("project", "project.id", "ticket.project_id")
        .select(["notification.id", "notification.kind", "notification.message", "notification.read_at", "notification.created_at", "notification.actor_user_id", "notification.ticket_id", "project.key as project_key", "ticket.sequence_number as sequence_number"])
        .where("notification.workspace_id", "=", ctx.workspaceId).where("notification.user_id", "=", ctx.userId)
        .orderBy("notification.created_at", "desc").limit(limit ?? 100);
      if (unread) q = q.where("notification.read_at", "is", null);
      const [rows, count] = await Promise.all([
        q.execute(),
        ctx.db.selectFrom("notification").select((eb) => eb.fn.countAll().as("c")).where("workspace_id", "=", ctx.workspaceId).where("user_id", "=", ctx.userId).where("read_at", "is", null).executeTakeFirst(),
      ]);
      return { items: rows.map((r: any) => ({ ...toApi(r), ticketIdentifier: r.project_key ? `${r.project_key}-${r.sequence_number}` : null })), unreadCount: Number(count?.c ?? 0) };
    },
  }),
  route({
    name: "markNotificationsRead", method: "POST", path: "/notifications/read",
    description: "Marks the given notifications (or all, with all=true) as read.",
    request: z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() }), response: ok,
    handler: async (ctx, { ids, all }) => {
      if (!ctx.userId) return { ok: true };
      let q = ctx.db.updateTable("notification").set({ read_at: new Date() }).where("workspace_id", "=", ctx.workspaceId).where("user_id", "=", ctx.userId).where("read_at", "is", null);
      if (!all) {
        if (!ids?.length) throw badRequest("ids or all=true required");
        q = q.where("id", "in", ids);
      }
      await q.execute();
      return { ok: true };
    },
  }),

  // ── my work / search across the workspace ──────────────────────────────
  route({
    name: "listMyTickets", method: "GET", path: "/my/tickets",
    description: "Open tickets assigned to the caller across all projects in the workspace (or tickets they watch, with scope=watching).",
    request: z.object({ scope: z.enum(["assigned", "watching", "created"]).optional(), includeDone: z.coerce.boolean().optional() }),
    response: anyList,
    handler: async (ctx, { scope, includeDone }) => {
      if (!ctx.userId) return [];
      let q = ctx.db
        .selectFrom("ticket").innerJoin("project", "project.id", "ticket.project_id").innerJoin("status", "status.id", "ticket.status_id")
        .selectAll("ticket").select(["project.key as project_key", "project.name as project_name", "status.name as status_name", "status.color as status_color", "status.category as status_category"])
        .where("project.workspace_id", "=", ctx.workspaceId).where("ticket.archived_at", "is", null).where("project.archived_at", "is", null);
      const s = scope ?? "assigned";
      if (s === "assigned") q = q.where("ticket.assignee_user_id", "=", ctx.userId);
      else if (s === "created") q = q.where("ticket.created_by", "=", ctx.userId);
      else q = q.where("ticket.id", "in", ctx.db.selectFrom("ticket_watcher").select("ticket_id").where("user_id", "=", ctx.userId));
      if (!includeDone) q = q.where("status.category", "in", ["backlog", "todo", "in_progress"]);
      const rows = await q.orderBy("ticket.due_date").orderBy("ticket.updated_at", "desc").limit(300).execute();
      return rows.map((r: any) => ({ ...toApi(r), identifier: `${r.project_key}-${r.sequence_number}` }));
    },
  }),
  route({
    name: "searchWorkspace", method: "GET", path: "/search",
    description: "Command-palette search: projects (name/key), tickets (title or identifier) and epics (title) across the whole workspace.",
    request: z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).optional() }),
    response: z.object({ projects: anyList, tickets: anyList, epics: anyList }),
    handler: async (ctx, { q, limit }) => {
      const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
      const n = limit ?? 8;
      const ident = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(q.trim());
      const [projects, tickets, epics] = await Promise.all([
        ctx.db.selectFrom("project").select(["id", "key", "name", "space_id"]).where("workspace_id", "=", ctx.workspaceId).where((eb) => eb.or([eb("name", "ilike", like), eb("key", "ilike", like)])).limit(n).execute(),
        ctx.db
          .selectFrom("ticket").innerJoin("project", "project.id", "ticket.project_id")
          .select(["ticket.id", "ticket.title", "ticket.sequence_number", "project.key as project_key"])
          .where("project.workspace_id", "=", ctx.workspaceId)
          .where((eb) => (ident ? eb.or([eb.and([eb("project.key", "=", ident[1].toUpperCase()), eb("ticket.sequence_number", "=", Number(ident[2]))]), eb("ticket.title", "ilike", like)]) : eb("ticket.title", "ilike", like)))
          .orderBy("ticket.updated_at", "desc").limit(n).execute(),
        ctx.db.selectFrom("epic").innerJoin("project", "project.id", "epic.project_id").select(["epic.id", "epic.title", "project.key as project_key"]).where("project.workspace_id", "=", ctx.workspaceId).where("epic.title", "ilike", like).limit(n).execute(),
      ]);
      return {
        projects: toApiList(projects),
        tickets: tickets.map((t: any) => ({ id: t.id, title: t.title, identifier: `${t.project_key}-${t.sequence_number}`, projectKey: t.project_key })),
        epics: toApiList(epics),
      };
    },
  }),

  // ── per-user preferences (last view, collapsed groups, theme overrides…) ─
  route({
    name: "getPreference", method: "GET", path: "/preferences/:key",
    description: "Reads a per-user UI preference (opaque JSON).", request: z.object({ key: z.string() }), response: anyObject,
    handler: async (ctx, { key }) => {
      if (!ctx.userId) return {};
      const r = await ctx.db.selectFrom("user_preference").select("value").where("workspace_id", "=", ctx.workspaceId).where("user_id", "=", ctx.userId).where("key", "=", key).executeTakeFirst();
      return (r?.value as object) ?? {};
    },
  }),
  route({
    name: "setPreference", method: "PUT", path: "/preferences/:key",
    description: "Writes a per-user UI preference.", request: z.object({ key: z.string(), value: z.record(z.string(), z.any()) }), response: ok,
    handler: async (ctx, { key, value }) => {
      if (!ctx.userId) throw badRequest("preferences need a user session");
      const v = JSON.stringify(value);
      await ctx.db.insertInto("user_preference").values({ workspace_id: ctx.workspaceId, user_id: ctx.userId, key, value: v }).onConflict((oc) => oc.columns(["workspace_id", "user_id", "key"]).doUpdateSet({ value: v })).execute();
      return { ok: true };
    },
  }),

  // ── public share links ─────────────────────────────────────────────────
  route({
    name: "createShareLink", method: "POST", path: "/projects/:projectId/share",
    description: "Creates a read-only public link for a project board, or for a single ticket (ticketId). The token is the only credential.",
    request: z.object({ projectId: z.string(), ticketId: z.string().optional() }), response: anyObject,
    handler: async (ctx, { projectId, ticketId }) => {
      const p = await resolveProject(ctx, projectId);
      let tid: string | null = null;
      if (ticketId) {
        const t = await resolveTicket(ctx, ticketId);
        if (t.project_id !== p.id) throw badRequest("ticket is not in this project");
        tid = t.id;
      }
      const row = await ctx.db.insertInto("share_link").values({ id: ulid(), token: randomBytes(24).toString("base64url"), project_id: p.id, ticket_id: tid, created_by: ctx.userId }).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "listShareLinks", method: "GET", path: "/projects/:projectId/share",
    description: "Active share links of a project.", request: z.object({ projectId: z.string() }), response: anyList,
    handler: async (ctx, { projectId }) => {
      const p = await resolveProject(ctx, projectId);
      return toApiList(await ctx.db.selectFrom("share_link").selectAll().where("project_id", "=", p.id).where("revoked_at", "is", null).orderBy("created_at", "desc").execute());
    },
  }),
  route({
    name: "revokeShareLink", method: "DELETE", path: "/projects/:projectId/share/:id",
    description: "Revokes a share link immediately.", request: z.object({ projectId: z.string(), id: z.string() }), response: ok,
    handler: async (ctx, { projectId, id }) => {
      const p = await resolveProject(ctx, projectId);
      await ctx.db.updateTable("share_link").set({ revoked_at: new Date() }).where("id", "=", id).where("project_id", "=", p.id).execute();
      return { ok: true };
    },
  }),
  route({
    name: "getPublicShare", method: "GET", path: "/public/:token", auth: "public",
    description: "Public, unauthenticated, read-only view for a share token: project board (statuses + tickets) or a single ticket with comments and checklists. No user ids are exposed.",
    request: z.object({ token: z.string() }), response: anyObject,
    handler: async (ctx, { token }) => {
      const link = await ctx.db.selectFrom("share_link").selectAll().where("token", "=", token).where("revoked_at", "is", null).executeTakeFirst();
      if (!link) throw notFound("share_not_found");
      const project = await ctx.db.selectFrom("project").select(["id", "key", "name", "description"]).where("id", "=", link.project_id).executeTakeFirstOrThrow();
      const statuses = await ctx.db.selectFrom("status").select(["id", "name", "color", "category", "position"]).where("project_id", "=", project.id).orderBy("position").execute();
      const strip = (t: any) => { const { assigneeUserId, createdBy, ...rest } = t; void assigneeUserId; void createdBy; return rest; };
      if (link.ticket_id) {
        const t = await ctx.db.selectFrom("ticket").selectAll().where("id", "=", link.ticket_id).executeTakeFirst();
        if (!t) throw notFound("share_not_found");
        const [h] = await hydrateTickets(ctx, project.key, [t]);
        const checklists = await ctx.db.selectFrom("ticket_checklist").selectAll().where("ticket_id", "=", t.id).orderBy("position").execute();
        const items = checklists.length ? await ctx.db.selectFrom("ticket_checklist_item").selectAll().where("checklist_id", "in", checklists.map((c: any) => c.id)).orderBy("position").execute() : [];
        const comments = await ctx.db.selectFrom("ticket_comment").select(["id", "body", "created_at"]).where("ticket_id", "=", t.id).orderBy("created_at").execute();
        return { kind: "ticket", project: toApi(project), statuses: toApiList(statuses), ticket: strip(h), checklists: checklists.map((c: any) => ({ ...toApi(c), items: toApiList(items.filter((i: any) => i.checklist_id === c.id)) })), comments: toApiList(comments) };
      }
      const rows = await ctx.db.selectFrom("ticket").selectAll().where("project_id", "=", project.id).where("archived_at", "is", null).orderBy("position").limit(1000).execute();
      return { kind: "project", project: toApi(project), statuses: toApiList(statuses), tickets: (await hydrateTickets(ctx, project.key, rows)).map(strip) };
    },
  }),
];
