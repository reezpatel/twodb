import { z } from "zod";
import { ulid } from "ulid";
import { route, rawRoute, type RouteDef } from "../lib/route.js";
import { resolveTicket, identifier } from "../lib/access.js";
import { badRequest, conflict, notFound } from "../lib/http.js";
import { logActivity, addWatcher, notifyWatchers } from "../lib/activity.js";
import { toApi, toApiList } from "../lib/rows.js";
import { linkRelation, anyObject, anyList, ok } from "./schemas.js";

const T = <S extends z.ZodRawShape = {}>(_name: string, extra?: S) => z.object({ ticketId: z.string(), ...((extra ?? {}) as S) });

export const ticketExtraRoutes: RouteDef[] = [
  // ── comments ───────────────────────────────────────────────────────────
  route({
    name: "createComment", method: "POST", path: "/tickets/:ticketId/comments",
    description: "Adds a comment (markdown/HTML from the editor). The author auto-watches the ticket; watchers are notified.",
    request: T("c", { body: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { ticketId, body }) => {
      const t = await resolveTicket(ctx, ticketId);
      const row = await ctx.db.insertInto("ticket_comment").values({ id: ulid(), ticket_id: t.id, user_id: ctx.userId, body }).returningAll().executeTakeFirstOrThrow();
      await addWatcher(ctx, t.id, ctx.userId);
      await logActivity(ctx, t.id, "commented");
      await notifyWatchers(ctx, t.id, "comment", `New comment on ${identifier(t)}: ${t.title}`);
      return toApi(row);
    },
  }),
  route({
    name: "updateComment", method: "PATCH", path: "/tickets/:ticketId/comments/:id",
    description: "Edits your own comment.", request: T("c", { id: z.string(), body: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { ticketId, id, body }) => {
      const t = await resolveTicket(ctx, ticketId);
      const row = await ctx.db.updateTable("ticket_comment").set({ body, updated_at: new Date() }).where("id", "=", id).where("ticket_id", "=", t.id).where("user_id", "=", ctx.userId as string).returningAll().executeTakeFirst();
      if (!row) throw notFound("comment_not_found_or_not_yours");
      return toApi(row);
    },
  }),
  route({
    name: "deleteComment", method: "DELETE", path: "/tickets/:ticketId/comments/:id",
    description: "Deletes your own comment.", request: T("c", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      const res = await ctx.db.deleteFrom("ticket_comment").where("id", "=", id).where("ticket_id", "=", t.id).where("user_id", "=", ctx.userId as string).executeTakeFirst();
      if (!Number(res.numDeletedRows)) throw notFound("comment_not_found_or_not_yours");
      return { ok: true };
    },
  }),
  route({
    name: "listTicketActivity", method: "GET", path: "/tickets/:ticketId/activity",
    description: "Chronological activity feed (field changes, comments, created/archived).", request: T("a"), response: anyList,
    handler: async (ctx, { ticketId }) => {
      const t = await resolveTicket(ctx, ticketId);
      return toApiList(await ctx.db.selectFrom("ticket_activity").selectAll().where("ticket_id", "=", t.id).orderBy("created_at").execute());
    },
  }),

  // ── watchers ───────────────────────────────────────────────────────────
  route({
    name: "watchTicket", method: "PUT", path: "/tickets/:ticketId/watch",
    description: "Subscribes (watching=true) or unsubscribes the caller to a ticket's notifications.",
    request: T("w", { watching: z.boolean().default(true) }), response: ok,
    handler: async (ctx, { ticketId, watching }) => {
      const t = await resolveTicket(ctx, ticketId);
      if (!ctx.userId) throw badRequest("watching needs a user session");
      if (watching) await addWatcher(ctx, t.id, ctx.userId);
      else await ctx.db.deleteFrom("ticket_watcher").where("ticket_id", "=", t.id).where("user_id", "=", ctx.userId).execute();
      return { ok: true };
    },
  }),

  // ── checklists ─────────────────────────────────────────────────────────
  route({
    name: "createChecklist", method: "POST", path: "/tickets/:ticketId/checklists",
    description: "Adds a checklist to a ticket.", request: T("c", { title: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { ticketId, title }) => {
      const t = await resolveTicket(ctx, ticketId);
      const max = await ctx.db.selectFrom("ticket_checklist").select((eb) => eb.fn.max("position").as("m")).where("ticket_id", "=", t.id).executeTakeFirst();
      return { ...toApi(await ctx.db.insertInto("ticket_checklist").values({ id: ulid(), ticket_id: t.id, title, position: Number(max?.m ?? 0) + 1000 }).returningAll().executeTakeFirstOrThrow()), items: [] };
    },
  }),
  route({
    name: "updateChecklist", method: "PATCH", path: "/tickets/:ticketId/checklists/:id",
    description: "Renames or reorders a checklist.", request: T("c", { id: z.string(), title: z.string().optional(), position: z.number().optional() }), response: anyObject,
    handler: async (ctx, { ticketId, id, title, position }) => {
      const t = await resolveTicket(ctx, ticketId);
      const patch: Record<string, any> = {};
      if (title !== undefined) patch.title = title;
      if (position !== undefined) patch.position = position;
      const q = ctx.db.updateTable("ticket_checklist").where("id", "=", id).where("ticket_id", "=", t.id);
      const row = Object.keys(patch).length ? await q.set(patch).returningAll().executeTakeFirst() : await ctx.db.selectFrom("ticket_checklist").selectAll().where("id", "=", id).where("ticket_id", "=", t.id).executeTakeFirst();
      if (!row) throw notFound("checklist_not_found");
      return toApi(row);
    },
  }),
  route({
    name: "deleteChecklist", method: "DELETE", path: "/tickets/:ticketId/checklists/:id",
    description: "Deletes a checklist and its items.", request: T("c", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.deleteFrom("ticket_checklist").where("id", "=", id).where("ticket_id", "=", t.id).execute();
      return { ok: true };
    },
  }),
  route({
    name: "createChecklistItem", method: "POST", path: "/tickets/:ticketId/checklists/:checklistId/items",
    description: "Adds an item to a checklist.", request: T("c", { checklistId: z.string(), text: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { ticketId, checklistId, text }) => {
      const t = await resolveTicket(ctx, ticketId);
      const cl = await ctx.db.selectFrom("ticket_checklist").select("id").where("id", "=", checklistId).where("ticket_id", "=", t.id).executeTakeFirst();
      if (!cl) throw notFound("checklist_not_found");
      const max = await ctx.db.selectFrom("ticket_checklist_item").select((eb) => eb.fn.max("position").as("m")).where("checklist_id", "=", checklistId).executeTakeFirst();
      return toApi(await ctx.db.insertInto("ticket_checklist_item").values({ id: ulid(), checklist_id: checklistId, text, position: Number(max?.m ?? 0) + 1000 }).returningAll().executeTakeFirstOrThrow());
    },
  }),
  route({
    name: "updateChecklistItem", method: "PATCH", path: "/tickets/:ticketId/checklist-items/:id",
    description: "Edits, toggles (done) or reorders a checklist item.", request: T("c", { id: z.string(), text: z.string().optional(), done: z.boolean().optional(), position: z.number().optional() }), response: anyObject,
    handler: async (ctx, { ticketId, id, text, done, position }) => {
      const t = await resolveTicket(ctx, ticketId);
      const patch: Record<string, any> = {};
      if (text !== undefined) patch.text = text;
      if (done !== undefined) patch.done = done;
      if (position !== undefined) patch.position = position;
      const own = ctx.db.selectFrom("ticket_checklist").select("id").where("ticket_id", "=", t.id);
      const q = ctx.db.updateTable("ticket_checklist_item").where("id", "=", id).where("checklist_id", "in", own);
      const row = Object.keys(patch).length ? await q.set(patch).returningAll().executeTakeFirst() : await ctx.db.selectFrom("ticket_checklist_item").selectAll().where("id", "=", id).where("checklist_id", "in", own).executeTakeFirst();
      if (!row) throw notFound("item_not_found");
      return toApi(row);
    },
  }),
  route({
    name: "deleteChecklistItem", method: "DELETE", path: "/tickets/:ticketId/checklist-items/:id",
    description: "Deletes a checklist item.", request: T("c", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.deleteFrom("ticket_checklist_item").where("id", "=", id).where("checklist_id", "in", ctx.db.selectFrom("ticket_checklist").select("id").where("ticket_id", "=", t.id)).execute();
      return { ok: true };
    },
  }),

  // ── links / relations ──────────────────────────────────────────────────
  route({
    name: "createTicketLink", method: "POST", path: "/tickets/:ticketId/links",
    description: "Links this ticket to another one in the same workspace: blocks (this blocks target), relates_to, duplicates (this duplicates target).",
    request: T("l", { targetTicketId: z.string(), relation: linkRelation }), response: anyObject,
    handler: async (ctx, { ticketId, targetTicketId, relation }) => {
      const a = await resolveTicket(ctx, ticketId);
      const b = await resolveTicket(ctx, targetTicketId);
      if (a.id === b.id) throw badRequest("cannot link a ticket to itself");
      if (relation === "blocks") {
        // Reject direct cycles (target already blocks this one).
        const back = await ctx.db.selectFrom("ticket_link").select("id").where("source_ticket_id", "=", b.id).where("target_ticket_id", "=", a.id).where("relation", "=", "blocks").executeTakeFirst();
        if (back) throw conflict("this would create a circular blocking dependency");
      }
      const row = await ctx.db.insertInto("ticket_link").values({ id: ulid(), source_ticket_id: a.id, target_ticket_id: b.id, relation }).onConflict((oc) => oc.doNothing()).returningAll().executeTakeFirst();
      if (!row) throw conflict("link already exists");
      await logActivity(ctx, a.id, "linked", relation.replace("_", " "), null, identifier(b));
      await logActivity(ctx, b.id, "linked", `${relation.replace("_", " ")} (incoming)`, null, identifier(a));
      return toApi(row);
    },
  }),
  route({
    name: "deleteTicketLink", method: "DELETE", path: "/tickets/:ticketId/links/:id",
    description: "Removes a ticket link.", request: T("l", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.deleteFrom("ticket_link").where("id", "=", id).where((eb) => eb.or([eb("source_ticket_id", "=", t.id), eb("target_ticket_id", "=", t.id)])).execute();
      return { ok: true };
    },
  }),

  // ── custom field values ────────────────────────────────────────────────
  route({
    name: "setTicketFieldValue", method: "PUT", path: "/tickets/:ticketId/fields/:fieldId",
    description: "Sets (or clears with value=null) a custom-field value. Validated against the field type; select values must be an option id.",
    request: T("f", { fieldId: z.string(), value: z.any().nullable() }), response: ok,
    handler: async (ctx, { ticketId, fieldId, value }) => {
      const t = await resolveTicket(ctx, ticketId);
      const f = await ctx.db.selectFrom("custom_field").selectAll().where("id", "=", fieldId).where("project_id", "=", t.project_id).executeTakeFirst();
      if (!f) throw notFound("custom_field_not_found");
      if (value !== null) {
        const bad = (m: string) => badRequest(`invalid ${f.type} value: ${m}`);
        if (f.type === "number" && typeof value !== "number") throw bad("expected a number");
        if (f.type === "checkbox" && typeof value !== "boolean") throw bad("expected a boolean");
        if ((f.type === "text" || f.type === "url" || f.type === "date") && typeof value !== "string") throw bad("expected a string");
        if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad("expected YYYY-MM-DD");
        if (f.type === "select") {
          const o = await ctx.db.selectFrom("custom_field_option").select("id").where("id", "=", value).where("field_id", "=", fieldId).executeTakeFirst();
          if (!o) throw bad("unknown option");
        }
      }
      if (value === null) await ctx.db.deleteFrom("ticket_field_value").where("ticket_id", "=", t.id).where("field_id", "=", fieldId).execute();
      else
        await ctx.db.insertInto("ticket_field_value").values({ ticket_id: t.id, field_id: fieldId, value: JSON.stringify(value) }).onConflict((oc) => oc.columns(["ticket_id", "field_id"]).doUpdateSet({ value: JSON.stringify(value) })).execute();
      await logActivity(ctx, t.id, "updated", f.name, null, value === null ? null : String(value));
      return { ok: true };
    },
  }),

  // ── dev links (PR / branch / commit) ───────────────────────────────────
  route({
    name: "createDevLink", method: "POST", path: "/tickets/:ticketId/dev-links",
    description: "Attaches a pull request / branch / commit URL with its state and CI status (set manually or by an external caller).",
    request: T("d", {
      url: z.string().url(), provider: z.string().optional(), kind: z.enum(["pull_request", "branch", "commit"]).optional(), title: z.string().optional(),
      state: z.enum(["open", "draft", "merged", "closed"]).optional(), ciState: z.enum(["pending", "success", "failure"]).nullable().optional(),
    }),
    response: anyObject,
    handler: async (ctx, { ticketId, url, provider, kind, title, state, ciState }) => {
      const t = await resolveTicket(ctx, ticketId);
      const row = await ctx.db
        .insertInto("ticket_dev_link")
        .values({ id: ulid(), ticket_id: t.id, url, provider: provider ?? (url.includes("gitlab") ? "gitlab" : "github"), kind: kind ?? "pull_request", title: title ?? url, state: state ?? "open", ci_state: ciState ?? null })
        .returningAll().executeTakeFirstOrThrow();
      await logActivity(ctx, t.id, "linked", "development", null, title ?? url);
      return toApi(row);
    },
  }),
  route({
    name: "updateDevLink", method: "PATCH", path: "/tickets/:ticketId/dev-links/:id",
    description: "Updates a dev link's title, state or CI status.",
    request: T("d", { id: z.string(), title: z.string().optional(), state: z.enum(["open", "draft", "merged", "closed"]).optional(), ciState: z.enum(["pending", "success", "failure"]).nullable().optional() }),
    response: anyObject,
    handler: async (ctx, { ticketId, id, title, state, ciState }) => {
      const t = await resolveTicket(ctx, ticketId);
      const patch: Record<string, any> = { updated_at: new Date() };
      if (title !== undefined) patch.title = title;
      if (state !== undefined) patch.state = state;
      if (ciState !== undefined) patch.ci_state = ciState;
      const row = await ctx.db.updateTable("ticket_dev_link").set(patch).where("id", "=", id).where("ticket_id", "=", t.id).returningAll().executeTakeFirst();
      if (!row) throw notFound("dev_link_not_found");
      return toApi(row);
    },
  }),
  route({
    name: "deleteDevLink", method: "DELETE", path: "/tickets/:ticketId/dev-links/:id",
    description: "Removes a dev link.", request: T("d", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      await ctx.db.deleteFrom("ticket_dev_link").where("id", "=", id).where("ticket_id", "=", t.id).execute();
      return { ok: true };
    },
  }),

  // ── attachments (binary; stored through core-data/storage) ─────────────
  rawRoute({
    name: "uploadAttachment", method: "POST", path: "/tickets/:ticketId/attachments",
    description: "Uploads a file as the raw request body (Content-Type = file type). Query: ?fileName=<name>. Max 25 MB.",
    raw: async (ctx, req, reply) => {
      const t = await resolveTicket(ctx, (req.params as any).ticketId);
      const fileName = String((req.query as any).fileName ?? "").replace(/[\\/]/g, "_").trim();
      const buf = req.body as Buffer;
      if (!fileName) throw badRequest("fileName query param is required");
      if (!Buffer.isBuffer(buf) || !buf.length) throw badRequest("empty body");
      if (buf.length > 25 * 1024 * 1024) return reply.code(413).send({ error: "file_too_large" });
      const id = ulid();
      const contentType = String(req.headers["content-type"] ?? "application/octet-stream");
      const key = `attachments/${t.project_id}/${t.id}/${id}`;
      await ctx.storage.put(key, buf, { contentType });
      const row = await ctx.db.insertInto("ticket_attachment").values({ id, ticket_id: t.id, storage_key: key, file_name: fileName, content_type: contentType, size: buf.length, uploaded_by: ctx.userId }).returning(["id", "ticket_id", "file_name", "content_type", "size", "uploaded_by", "created_at"]).executeTakeFirstOrThrow();
      await logActivity(ctx, t.id, "attached", "file", null, fileName);
      return reply.send(toApi(row));
    },
  }),
  rawRoute({
    name: "downloadAttachment", method: "GET", path: "/tickets/:ticketId/attachments/:id",
    description: "Downloads an attachment (binary).",
    raw: async (ctx, req, reply) => {
      const t = await resolveTicket(ctx, (req.params as any).ticketId);
      const a = await ctx.db.selectFrom("ticket_attachment").selectAll().where("id", "=", (req.params as any).id).where("ticket_id", "=", t.id).executeTakeFirst();
      if (!a) throw notFound("attachment_not_found");
      const inline = a.content_type.startsWith("image/") || a.content_type === "application/pdf";
      return reply
        .header("content-type", a.content_type)
        .header("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.file_name)}`)
        .send(await ctx.storage.get(a.storage_key));
    },
  }),
  route({
    name: "deleteAttachment", method: "DELETE", path: "/tickets/:ticketId/attachments/:id",
    description: "Deletes an attachment and its blob.", request: T("a", { id: z.string() }), response: ok,
    handler: async (ctx, { ticketId, id }) => {
      const t = await resolveTicket(ctx, ticketId);
      const a = await ctx.db.deleteFrom("ticket_attachment").where("id", "=", id).where("ticket_id", "=", t.id).returning(["storage_key", "file_name"]).executeTakeFirst();
      if (a) {
        await ctx.storage.delete(a.storage_key).catch(() => {});
        await logActivity(ctx, t.id, "removed", "file", a.file_name, null);
      }
      return { ok: true };
    },
  }),
];
