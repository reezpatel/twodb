import Fastify, { type FastifyRequest } from "fastify";
import { createPgDb, type Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import { manifest, calendarInput, eventInput, rangeQuery } from "./manifest.js";
interface Calendar { id: string; workspaceId: string; spaceId: string; name: string; color: string; createdAt: string }
interface Event { id: string; calendarId: string; title: string; description: string; location: string; allDay: boolean; startAt: string | null; endAt: string | null; startDate: string | null; endDate: string | null; createdAt: string; updatedAt: string }
export interface CalendarDb { calendar: Calendar; event: Event }
async function applySchema(db: Kysely<CalendarDb>) {
  await db.schema.createTable("calendar").ifNotExists().addColumn("id", "text", c => c.primaryKey()).addColumn("workspaceId", "text", c => c.notNull()).addColumn("spaceId", "text", c => c.notNull()).addColumn("name", "text", c => c.notNull()).addColumn("color", "text", c => c.notNull()).addColumn("createdAt", "text", c => c.notNull()).execute();
  await db.schema.createIndex("calendar_scope_idx").ifNotExists().on("calendar").columns(["workspaceId", "spaceId"]).execute();
  await db.schema.createTable("event").ifNotExists().addColumn("id", "text", c => c.primaryKey()).addColumn("calendarId", "text", c => c.notNull().references("calendar.id").onDelete("cascade")).addColumn("title", "text", c => c.notNull()).addColumn("description", "text", c => c.notNull()).addColumn("location", "text", c => c.notNull()).addColumn("allDay", "boolean", c => c.notNull()).addColumn("startAt", "text").addColumn("endAt", "text").addColumn("startDate", "text").addColumn("endDate", "text").addColumn("createdAt", "text", c => c.notNull()).addColumn("updatedAt", "text", c => c.notNull()).execute();
  await db.schema.createIndex("event_calendar_idx").ifNotExists().on("event").columns(["calendarId", "startAt"]).execute();
}
function context(req: FastifyRequest) {
  const kind = req.headers["x-twodb-auth-kind"], workspaceId = req.headers["x-twodb-workspace-id"], spaces = req.headers["x-twodb-space-ids"];
  if ((kind !== "session" && kind !== "apiKey") || typeof workspaceId !== "string" || !workspaceId) return null;
  return { workspaceId, spaceIds: typeof spaces === "string" ? spaces.split(",").map(s => s.trim()).filter(Boolean) : [] };
}
export async function buildServer(config: { databaseUrl: string; registrationToken: string; httpUrl: string }, injectedDb?: Kysely<CalendarDb>) {
  const db = injectedDb ?? createPgDb<CalendarDb>({ connectionString: config.databaseUrl, schema: "twoday" });
  await applySchema(db);
  const app = Fastify({ logger: !injectedDb });
  app.addHook("onClose", async () => { if (!injectedDb) await db.destroy(); });
  app.setErrorHandler<Error & { statusCode?: number }>((error, _req, reply) => { app.log.error(error); return reply.code(error.statusCode ?? 500).send({ error: "Request failed" }); });
  app.get("/healthz", async () => ({ ok: true, app: "twoday" }));
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => { const result = handleManifestRequest(manifest, config, req.headers[REGISTRATION_TOKEN_HEADER]); return reply.code(result.status).send(result.body); });
  app.register(async routes => {
    routes.addHook("preHandler", async (req, reply) => { if (!context(req)) return reply.code(401).send({ error: "unauthorized" }); });
    const calendars = (req: FastifyRequest) => { const ctx = context(req)!; return db.selectFrom("calendar").selectAll().where("workspaceId", "=", ctx.workspaceId).where("spaceId", "in", ctx.spaceIds.length ? ctx.spaceIds : [""]); };
    routes.get("/calendars", async req => (await calendars(req).orderBy("name").execute()).map(({ workspaceId, ...row }) => row));
    routes.post("/calendars", async (req, reply) => {
      const input = calendarInput.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const ctx = context(req)!;
      if (!ctx.spaceIds.includes(input.data.spaceId)) return reply.code(403).send({ error: "space_forbidden" });
      const row = { ...input.data, id: ulid(), workspaceId: ctx.workspaceId, createdAt: new Date().toISOString() };
      await db.insertInto("calendar").values(row).execute();
      const { workspaceId, ...calendar } = row; return reply.code(201).send(calendar);
    });
    routes.get("/events", async (req, reply) => {
      const input = rangeQuery.safeParse(req.query);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const { calendarId, from, to, limit, offset } = input.data;
      let query = db.selectFrom("event").selectAll().where("calendarId", "in", calendars(req).clearSelect().select("id"));
      if (calendarId) query = query.where("calendarId", "=", calendarId);
      return query.where(eb => eb.or([
        eb.and([eb("allDay", "=", true), eb("startDate", "<", to), eb("endDate", ">", from)]),
        eb.and([eb("allDay", "=", false), eb("startAt", "<", `${to}T00:00:00.000Z`), eb("endAt", ">", `${from}T00:00:00.000Z`)]),
      ])).orderBy("startDate").orderBy("startAt").orderBy("id").limit(limit).offset(offset).execute();
    });
    routes.post("/events", async (req, reply) => {
      const input = eventInput.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      if (!await calendars(req).where("id", "=", input.data.calendarId).executeTakeFirst()) return reply.code(404).send({ error: "calendar_not_found" });
      const now = new Date().toISOString(), row = { ...input.data, id: ulid(), createdAt: now, updatedAt: now };
      await db.insertInto("event").values(row).execute(); return reply.code(201).send(row);
    });
    routes.put<{ Params: { id: string } }>("/events/:id", async (req, reply) => {
      const input = eventInput.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const row = await db.updateTable("event").set({ ...input.data, updatedAt: new Date().toISOString() }).where("id", "=", req.params.id).where("calendarId", "=", input.data.calendarId).where("calendarId", "in", calendars(req).clearSelect().select("id")).returningAll().executeTakeFirst();
      return row ?? reply.code(404).send({ error: "event_not_found" });
    });
    routes.delete<{ Params: { id: string } }>("/events/:id", async (req, reply) => {
      const row = await db.deleteFrom("event").where("id", "=", req.params.id).where("calendarId", "in", calendars(req).clearSelect().select("id")).returning("id").executeTakeFirst();
      return row ? { ok: true } : reply.code(404).send({ error: "event_not_found" });
    });
  });
  return app;
}
