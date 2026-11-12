import { z } from "zod";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { resolveTicket, assertInProject, identifier } from "../lib/access.js";
import { badRequest, notFound } from "../lib/http.js";
import { hydrateTickets, TICKET_PATCH_FIELDS, FIELD_LABEL } from "../lib/tickets.js";
import { logActivity, addWatcher, notifyWatchers } from "../lib/activity.js";
import { toApi, toApiList, toColumns } from "../lib/rows.js";
import { date, priority, ticketSchema, anyObject, ok } from "./schemas.js";

const patchShape = {
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: priority.nullable().optional(),
  statusId: z.string().optional(),
  typeId: z.string().nullable().optional(),
  epicId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
  estimatePoints: z.number().nullable().optional(),
  estimateMinutes: z.number().int().nullable().optional(),
  startDate: date.nullable().optional(),
  dueDate: date.nullable().optional(),
  position: z.number().optional(),
  labelIds: z.array(z.string()).optional(),
};
const patchSchema = z.object(patchShape);
type Patch = z.infer<typeof patchSchema>;

/** Applies a patch to one (already resolved) ticket, validating relations and recording activity. */
export async function applyTicketPatch(ctx: Ctx, ticket: Record<string, any>, patch: Patch) {
  return ctx.db.transaction().execute(async (trx) => {
    const t: Ctx = { ...ctx, db: trx };
    const pid = ticket.project_id as string;
    await assertInProject(t, "status", patch.statusId, pid);
    await assertInProject(t, "epic", patch.epicId, pid);
    await assertInProject(t, "milestone", patch.milestoneId, pid);
    await assertInProject(t, "ticket_type", patch.typeId, pid);
    for (const l of patch.labelIds ?? []) await assertInProject(t, "label", l, pid);
    if (patch.parentId) {
      if (patch.parentId === ticket.id) throw badRequest("a ticket cannot be its own parent");
      const parent = await trx.selectFrom("ticket").select(["id", "parent_id"]).where("id", "=", patch.parentId).where("project_id", "=", pid).executeTakeFirst();
      if (!parent) throw badRequest("parent ticket not found in this project");
      if (parent.parent_id) throw badRequest("sub-tasks can only be one level deep");
      const kids = await trx.selectFrom("ticket").select("id").where("parent_id", "=", ticket.id).limit(1).executeTakeFirst();
      if (kids) throw badRequest("a ticket with sub-tasks cannot become a sub-task");
    }
    const cols = toColumns(patch, TICKET_PATCH_FIELDS);
    const changed: { field: string; from: unknown; to: unknown }[] = [];
    for (const k of TICKET_PATCH_FIELDS) {
      const snakeKey = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      if (cols[snakeKey] === undefined) continue;
      let before = ticket[snakeKey];
      if (before instanceof Date) before = before.toISOString().slice(0, 10);
      if (String(before ?? "") !== String(cols[snakeKey] ?? "") && FIELD_LABEL[k]) changed.push({ field: k, from: before, to: cols[snakeKey] });
    }
    if (Object.keys(cols).length) {
      await trx.updateTable("ticket").set({ ...cols, updated_at: new Date() }).where("id", "=", ticket.id).execute();
    }
    if (patch.labelIds) {
      await trx.deleteFrom("ticket_label").where("ticket_id", "=", ticket.id).execute();
      if (patch.labelIds.length) await trx.insertInto("ticket_label").values(patch.labelIds.map((label_id) => ({ ticket_id: ticket.id, label_id }))).execute();
      changed.push({ field: "labels", from: null, to: patch.labelIds.length });
    }
    // Resolve human-readable names for the activity feed (ids are useless to read).
    const nameOf = async (field: string, id: unknown) => {
      if (id == null || id === "") return null;
      const table = ({ statusId: "status", epicId: "epic", milestoneId: "milestone", typeId: "ticket_type" } as Record<string, string>)[field];
      if (!table) return id;
      const col = table === "epic" ? "title" : "name";
      const r = await trx.selectFrom(table as any).select(col as any).where("id", "=", id as string).executeTakeFirst();
      return (r as any)?.[col] ?? id;
    };
    for (const c of changed) {
      if (c.field === "labels") { await logActivity(t, ticket.id, "updated", "labels", null, `${c.to} label(s)`); continue; }
      if (c.field === "description") { await logActivity(t, ticket.id, "updated", "description"); continue; }
      await logActivity(t, ticket.id, "updated", FIELD_LABEL[c.field], await nameOf(c.field, c.from), await nameOf(c.field, c.to));
    }
    const ident = identifier(ticket as any);
    if (patch.assigneeUserId && patch.assigneeUserId !== ticket.assignee_user_id) {
      await addWatcher(t, ticket.id, patch.assigneeUserId);
      await notifyWatchers(t, ticket.id, "assigned", `You were assigned ${ident}: ${patch.title ?? ticket.title}`, [patch.assigneeUserId]);
    }
    if (patch.statusId && patch.statusId !== ticket.status_id) {
      const s = await trx.selectFrom("status").select("name").where("id", "=", patch.statusId).executeTakeFirst();
      await notifyWatchers(t, ticket.id, "status", `${ident} moved to ${s?.name}`);
    }
    return trx.selectFrom("ticket").selectAll().where("id", "=", ticket.id).executeTakeFirstOrThrow();
  });
}

export const ticketDetailRoutes: RouteDef[] = [
  route({
    name: "getTicket",
    method: "GET",
    path: "/tickets/:ticketId",
    description:
      "Full ticket detail by id or identifier (PLAN-12): relations (epic, milestone, parent, sub-tasks), labels, custom-field values, links, " +
      "dev links, checklists, watchers, attachments and comments.",
    request: z.object({ ticketId: z.string() }),
    response: anyObject,
    handler: async (ctx, { ticketId }) => {
      const t = await resolveTicket(ctx, ticketId);
      const db = ctx.db;
      const [hydrated] = await hydrateTickets(ctx, t.project_key, [t]);
      const [subtasks, links, devLinks, checklists, watchers, attachments, fieldValues, comments] = await Promise.all([
        db.selectFrom("ticket").selectAll().where("parent_id", "=", t.id).orderBy("position").execute(),
        db
          .selectFrom("ticket_link")
          .selectAll()
          .where((eb) => eb.or([eb("source_ticket_id", "=", t.id), eb("target_ticket_id", "=", t.id)]))
          .execute(),
        db.selectFrom("ticket_dev_link").selectAll().where("ticket_id", "=", t.id).orderBy("created_at").execute(),
        db.selectFrom("ticket_checklist").selectAll().where("ticket_id", "=", t.id).orderBy("position").execute(),
        db.selectFrom("ticket_watcher").select("user_id").where("ticket_id", "=", t.id).execute(),
        db.selectFrom("ticket_attachment").select(["id", "ticket_id", "file_name", "content_type", "size", "uploaded_by", "created_at"]).where("ticket_id", "=", t.id).orderBy("created_at").execute(),
        db.selectFrom("ticket_field_value").selectAll().where("ticket_id", "=", t.id).execute(),
        db.selectFrom("ticket_comment").selectAll().where("ticket_id", "=", t.id).orderBy("created_at").execute(),
      ]);
      const items = checklists.length
        ? await db.selectFrom("ticket_checklist_item").selectAll().where("checklist_id", "in", checklists.map((c: any) => c.id)).orderBy("position").execute()
        : [];
      // Resolve the other side of each link into a compact reference.
      const otherIds = [...new Set(links.map((l: any) => (l.source_ticket_id === t.id ? l.target_ticket_id : l.source_ticket_id)))];
      const others = otherIds.length
        ? await db
            .selectFrom("ticket").innerJoin("project", "project.id", "ticket.project_id").innerJoin("status", "status.id", "ticket.status_id")
            .select(["ticket.id", "ticket.title", "ticket.sequence_number", "project.key as key", "status.category as status_category", "status.name as status_name"])
            .where("ticket.id", "in", otherIds as string[])
            .execute()
        : [];
      const ref = new Map(others.map((o: any) => [o.id, { id: o.id, identifier: `${o.key}-${o.sequence_number}`, title: o.title, statusCategory: o.status_category, statusName: o.status_name }]));
      const parent = t.parent_id
        ? await db.selectFrom("ticket").select(["id", "title", "sequence_number"]).where("id", "=", t.parent_id).executeTakeFirst()
        : null;
      const subs = await hydrateTickets(ctx, t.project_key, subtasks);
      return {
        ...hydrated,
        projectKey: t.project_key,
        parent: parent ? { id: parent.id, identifier: `${t.project_key}-${parent.sequence_number}`, title: parent.title } : null,
        subtasks: subs,
        links: links.map((l: any) => {
          const outgoing = l.source_ticket_id === t.id;
          return { id: l.id, relation: l.relation, direction: outgoing ? "outgoing" : "incoming", ticket: ref.get(outgoing ? l.target_ticket_id : l.source_ticket_id) };
        }),
        devLinks: toApiList(devLinks),
        checklists: checklists.map((c: any) => ({ ...toApi(c), items: toApiList(items.filter((i: any) => i.checklist_id === c.id)) })),
        watcherUserIds: watchers.map((w: any) => w.user_id),
        attachments: toApiList(attachments),
        fieldValues: Object.fromEntries(fieldValues.map((f: any) => [f.field_id, f.value])),
        comments: toApiList(comments),
      };
    },
  }),
  route({
    name: "updateTicket",
    method: "PATCH",
    path: "/tickets/:ticketId",
    description: "Updates any ticket field (including labels, status, epic, milestone, parent). Every change is written to the activity feed and notifies watchers.",
    request: patchSchema.extend({ ticketId: z.string() }),
    response: ticketSchema,
    handler: async (ctx, { ticketId, ...patch }) => {
      const t = await resolveTicket(ctx, ticketId);
      const row = await applyTicketPatch(ctx, t, patch);
      const [h] = await hydrateTickets(ctx, t.project_key, [row]);
      return h;
    },
  }),
  route({
    name: "archiveTicket",
    method: "POST",
    path: "/tickets/:ticketId/archive",
    description: "Archives (or restores, restore=true) a ticket; archived tickets are hidden from boards and lists.",
    request: z.object({ ticketId: z.string(), restore: z.boolean().optional() }),
    response: ok,
    handler: async (ctx, { ticketId, restore }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.updateTable("ticket").set({ archived_at: restore ? null : new Date(), updated_at: new Date() }).where("id", "=", t.id).execute();
      await logActivity(ctx, t.id, restore ? "restored" : "archived");
      return { ok: true };
    },
  }),
  route({
    name: "deleteTicket",
    method: "DELETE",
    path: "/tickets/:ticketId",
    description: "Permanently deletes a ticket. Its sub-tasks are detached (become top-level), not deleted.",
    request: z.object({ ticketId: z.string() }),
    response: ok,
    handler: async (ctx, { ticketId }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.deleteFrom("ticket").where("id", "=", t.id).execute();
      return { ok: true };
    },
  }),
  route({
    name: "bulkUpdateTickets",
    method: "POST",
    path: "/projects/:projectId/tickets/bulk",
    description: "Applies one patch (status, assignee, priority, epic, milestone, labels to add/remove) or archive/delete to many tickets at once.",
    request: z.object({
      projectId: z.string(),
      ticketIds: z.array(z.string()).min(1).max(500),
      action: z.enum(["update", "archive", "delete"]).default("update"),
      patch: z.object({ statusId: z.string().optional(), assigneeUserId: z.string().nullable().optional(), priority: priority.nullable().optional(), epicId: z.string().nullable().optional(), milestoneId: z.string().nullable().optional(), typeId: z.string().nullable().optional() }).optional(),
      addLabelIds: z.array(z.string()).optional(),
      removeLabelIds: z.array(z.string()).optional(),
    }),
    response: z.object({ ok: z.literal(true), count: z.number() }),
    handler: async (ctx, input) => {
      const { resolveProject } = await import("../lib/access.js");
      const p = await resolveProject(ctx, input.projectId);
      const rows = await ctx.db.selectFrom("ticket").selectAll().where("project_id", "=", p.id).where("id", "in", input.ticketIds).execute();
      if (!rows.length) throw notFound("no matching tickets");
      if (input.action === "delete") {
        await ctx.db.deleteFrom("ticket").where("id", "in", rows.map((r: any) => r.id)).execute();
        return { ok: true as const, count: rows.length };
      }
      for (const r of rows) {
        const full = { ...r, project_key: p.key };
        if (input.action === "archive") {
          await ctx.db.updateTable("ticket").set({ archived_at: new Date(), updated_at: new Date() }).where("id", "=", r.id).execute();
          await logActivity(ctx, r.id as string, "archived");
          continue;
        }
        const patch: Patch = { ...(input.patch ?? {}) };
        if (input.addLabelIds?.length || input.removeLabelIds?.length) {
          const cur = (await ctx.db.selectFrom("ticket_label").select("label_id").where("ticket_id", "=", r.id).execute()).map((x: any) => x.label_id as string);
          patch.labelIds = [...new Set([...cur, ...(input.addLabelIds ?? [])])].filter((id) => !(input.removeLabelIds ?? []).includes(id));
        }
        await applyTicketPatch(ctx, full, patch);
      }
      return { ok: true as const, count: rows.length };
    },
  }),
];
