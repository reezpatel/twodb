import { z } from "zod";
import { ulid } from "ulid";
import { projectCrud } from "../lib/crud.js";
import { route, type RouteDef } from "../lib/route.js";
import { resolveProject, assertInProject } from "../lib/access.js";
import { toApi, toApiList } from "../lib/rows.js";
import { notFound } from "../lib/http.js";
import { anyObject, ok, priority } from "./schemas.js";
import { listFilters } from "./tickets-list-create.js";

const obj = z.record(z.string(), z.any());

/** Saved view = layout + filters (same filter vocabulary as listTickets) + sort/group. */
const viewShape = {
  name: z.string().min(1),
  layout: z.enum(["table", "board", "timeline"]),
  filters: listFilters.partial(),
  sortBy: z.enum(["position", "createdAt", "updatedAt", "dueDate", "priority", "title", "sequence"]),
  sortDir: z.enum(["asc", "desc"]),
  groupBy: z.enum(["status", "assignee", "priority", "epic", "milestone", "type"]).nullable(),
  shared: z.boolean(),
  position: z.number(),
};
const viewCreate = z.object({ ...viewShape }).partial().required({ name: true });
const viewRow = z.object({ id: z.string(), projectId: z.string(), name: z.string(), layout: z.string(), filters: obj, sortBy: z.string(), sortDir: z.string(), groupBy: z.string().nullable(), ownerUserId: z.string().nullable(), shared: z.boolean(), position: z.number() });

const docCreate = z.object({ title: z.string().min(1), kind: z.enum(["doc", "note"]).optional(), content: z.string().optional(), parentId: z.string().nullable().optional(), position: z.number().optional() });
const docRow = z.object({ id: z.string(), projectId: z.string(), kind: z.string(), parentId: z.string().nullable(), title: z.string(), content: z.string(), createdBy: z.string().nullable(), position: z.number(), createdAt: z.string(), updatedAt: z.string() });

const widget = z.object({
  id: z.string(),
  type: z.enum(["by_status", "by_priority", "by_assignee", "by_type", "by_epic", "by_milestone", "created_vs_completed", "overdue", "milestone_progress"]),
  title: z.string().optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

const tplCreate = z.object({
  name: z.string().min(1), title: z.string().optional(), description: z.string().optional(), typeId: z.string().nullable().optional(), priority: priority.nullable().optional(),
  labelIds: z.array(z.string()).optional(), checklist: z.array(z.object({ title: z.string(), items: z.array(z.string()) })).optional(), position: z.number().optional(),
});
const tplRow = z.object({ id: z.string(), projectId: z.string(), name: z.string(), title: z.string(), description: z.string(), typeId: z.string().nullable(), priority: z.string().nullable(), labelIds: z.array(z.string()), checklist: z.array(z.any()), position: z.number() });

export const projectContentRoutes: RouteDef[] = [
  ...projectCrud({
    entity: "View", plural: "Views", table: "project_view", segment: "views", touch: true, json: ["filters"],
    columns: ["name", "layout", "filters", "sortBy", "sortDir", "groupBy", "shared", "position"],
    onCreate: (ctx) => ({ owner_user_id: ctx.userId }),
    create: viewCreate, update: viewCreate.partial(), response: viewRow,
  }),
  ...projectCrud({
    entity: "Document", plural: "Documents", table: "project_document", segment: "documents", touch: true, orderBy: "position",
    columns: ["title", "kind", "content", "parentId", "position"], fks: { parentId: "project_document" },
    onCreate: (ctx) => ({ created_by: ctx.userId }),
    create: docCreate, update: docCreate.partial(), response: docRow,
  }),
  ...projectCrud({
    entity: "Dashboard", plural: "Dashboards", table: "dashboard", segment: "dashboards", touch: true, json: ["widgets"],
    columns: ["name", "widgets", "position"],
    create: z.object({ name: z.string().min(1), widgets: z.array(widget).optional(), position: z.number().optional() }),
    update: z.object({ name: z.string().min(1).optional(), widgets: z.array(widget).optional(), position: z.number().optional() }),
    response: z.object({ id: z.string(), projectId: z.string(), name: z.string(), widgets: z.array(widget), position: z.number() }),
  }),
  ...projectCrud({
    entity: "TicketTemplate", plural: "TicketTemplates", table: "ticket_template", segment: "ticket-templates", json: ["labelIds", "checklist"],
    columns: ["name", "title", "description", "typeId", "priority", "labelIds", "checklist", "position"], fks: { typeId: "ticket_type" },
    create: tplCreate, update: tplCreate.partial(), response: tplRow,
  }),

  // Documents can reference tickets (and show up on the ticket's "Documents" panel).
  route({
    name: "setDocumentTickets", method: "PUT", path: "/projects/:projectId/documents/:id/tickets",
    description: "Replaces the tickets a document is linked to.",
    request: z.object({ projectId: z.string(), id: z.string(), ticketIds: z.array(z.string()) }), response: ok,
    handler: async (ctx, { projectId, id, ticketIds }) => {
      const p = await resolveProject(ctx, projectId);
      await assertInProject(ctx, "project_document", id, p.id, "document");
      for (const t of ticketIds) await assertInProject(ctx, "ticket", t, p.id, "ticket");
      await ctx.db.transaction().execute(async (trx) => {
        await trx.deleteFrom("project_document_ticket").where("document_id", "=", id).execute();
        if (ticketIds.length) await trx.insertInto("project_document_ticket").values(ticketIds.map((ticket_id) => ({ document_id: id, ticket_id }))).execute();
      });
      return { ok: true };
    },
  }),
  route({
    name: "listTicketDocuments", method: "GET", path: "/tickets/:ticketId/documents",
    description: "Documents/notes linked to a ticket.", request: z.object({ ticketId: z.string() }), response: z.array(anyObject),
    handler: async (ctx, { ticketId }) => {
      const { resolveTicket } = await import("../lib/access.js");
      const t = await resolveTicket(ctx, ticketId);
      return toApiList(await ctx.db.selectFrom("project_document").select(["id", "project_id", "kind", "title", "updated_at"]).where("id", "in", ctx.db.selectFrom("project_document_ticket").select("document_id").where("ticket_id", "=", t.id)).execute());
    },
  }),
  route({
    name: "getDocumentTickets", method: "GET", path: "/projects/:projectId/documents/:id/tickets",
    description: "Ticket ids a document is linked to.", request: z.object({ projectId: z.string(), id: z.string() }), response: z.object({ ticketIds: z.array(z.string()) }),
    handler: async (ctx, { projectId, id }) => {
      const p = await resolveProject(ctx, projectId);
      const d = await ctx.db.selectFrom("project_document").select("id").where("id", "=", id).where("project_id", "=", p.id).executeTakeFirst();
      if (!d) throw notFound("document_not_found");
      return { ticketIds: (await ctx.db.selectFrom("project_document_ticket").select("ticket_id").where("document_id", "=", id).execute()).map((r: any) => r.ticket_id) };
    },
  }),
];

void ulid; void toApi;
