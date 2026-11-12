import Fastify, { type FastifyRequest } from "fastify";
import { createPgDb, type Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";

import { manifest, bookInput, contactInput, contactPatch, listQuery } from "./manifest.js";

interface Book { id: string; workspaceId: string; spaceId: string; name: string; createdAt: string }
interface Contact { id: string; bookId: string; name: string; email: string; phone: string; company: string; notes: string; pinned: boolean; createdAt: string; updatedAt: string }
export interface ContactsDb { book: Book; contact: Contact }
export async function applySchema(db: Kysely<ContactsDb>) {
  await db.schema.createTable("book").ifNotExists().addColumn("id", "text", c => c.primaryKey())
    .addColumn("workspaceId", "text", c => c.notNull()).addColumn("spaceId", "text", c => c.notNull())
    .addColumn("name", "text", c => c.notNull()).addColumn("createdAt", "text", c => c.notNull()).execute();
  await db.schema.createIndex("book_scope_idx").ifNotExists().on("book").columns(["workspaceId", "spaceId"]).execute();
  await db.schema.createTable("contact").ifNotExists().addColumn("id", "text", c => c.primaryKey())
    .addColumn("bookId", "text", c => c.notNull().references("book.id").onDelete("cascade"))
    .addColumn("name", "text", c => c.notNull()).addColumn("email", "text", c => c.notNull())
    .addColumn("phone", "text", c => c.notNull()).addColumn("company", "text", c => c.notNull())
    .addColumn("notes", "text", c => c.notNull()).addColumn("pinned", "boolean", c => c.notNull())
    .addColumn("createdAt", "text", c => c.notNull()).addColumn("updatedAt", "text", c => c.notNull()).execute();
  await db.schema.createIndex("contact_book_email_idx").ifNotExists().on("contact").columns(["bookId", "email"]).unique().execute();
}
export function context(req: FastifyRequest) {
  const kind = req.headers["x-twodb-auth-kind"];
  const workspaceId = req.headers["x-twodb-workspace-id"];
  if ((kind !== "session" && kind !== "apiKey") || typeof workspaceId !== "string" || !workspaceId) return null;
  const spaces = req.headers["x-twodb-space-ids"];
  return { workspaceId, spaceIds: typeof spaces === "string" ? spaces.split(",").map(s => s.trim()).filter(Boolean) : [] };
}
export async function buildServer(config: { databaseUrl: string }, injectedDb?: Kysely<ContactsDb>) {
  const db = injectedDb ?? createPgDb<ContactsDb>({ connectionString: config.databaseUrl, schema: "twocontacts" });
  await applySchema(db);
  const app = Fastify({ logger: !injectedDb });
  app.addHook("onClose", async () => { if (!injectedDb) await db.destroy(); });
  app.setErrorHandler<Error & { code?: string; validation?: unknown; statusCode?: number }>((error, _req, reply) => {
    if (error.code === "23505") return reply.code(409).send({ error: "A contact with that email already exists in this book." });
    if (error.validation || error.statusCode === 400) return reply.code(400).send({ error: "Invalid request" });
    app.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ error: "Request failed" });
  });
  app.get("/healthz", async () => ({ ok: true, app: "twocontacts" }));
  app.register(async routes => {
    routes.addHook("preHandler", async (req, reply) => { if (!context(req)) return reply.code(401).send({ error: "unauthorized" }); });
    const books = (req: FastifyRequest) => { const ctx = context(req)!; return db.selectFrom("book").selectAll().where("workspaceId", "=", ctx.workspaceId).where("spaceId", "in", ctx.spaceIds.length ? ctx.spaceIds : [""]); };
    const contacts = (req: FastifyRequest) => db.selectFrom("contact").selectAll("contact").where("bookId", "in", books(req).clearSelect().select("id"));
    routes.get("/books", async req => (await books(req).orderBy("name").execute()).map(({ workspaceId, ...book }) => book));
    routes.post("/books", async (req, reply) => {
      const input = bookInput.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const ctx = context(req)!;
      if (!ctx.spaceIds.includes(input.data.spaceId)) return reply.code(403).send({ error: "space_forbidden" });
      const row = { ...input.data, id: ulid(), workspaceId: ctx.workspaceId, createdAt: new Date().toISOString() };
      await db.insertInto("book").values(row).execute();
      const { workspaceId, ...book } = row;
      return reply.code(201).send(book);
    });
    for (const path of ["/contacts", "/contacts/suggest"]) routes.get(path, async (req, reply) => {
      const input = listQuery.safeParse(req.query);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const { bookId, q, limit, offset } = input.data;
      let query = contacts(req);
      if (bookId) query = query.where("bookId", "=", bookId);
      if (q) { const term = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`; query = query.where(eb => eb.or([eb("name", "ilike", term), eb("email", "ilike", term), eb("company", "ilike", term)])); }
      return query.orderBy("pinned", "desc").orderBy("name").orderBy("id").limit(path.endsWith("suggest") ? 10 : limit).offset(path.endsWith("suggest") ? 0 : offset).execute();
    });
    routes.post("/contacts", async (req, reply) => {
      const input = contactInput.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      if (!await books(req).where("id", "=", input.data.bookId).executeTakeFirst()) return reply.code(404).send({ error: "book_not_found" });
      const now = new Date().toISOString();
      const row = { ...input.data, id: ulid(), createdAt: now, updatedAt: now };
      await db.insertInto("contact").values(row).execute();
      return reply.code(201).send(row);
    });
    routes.patch<{ Params: { id: string } }>("/contacts/:id", async (req, reply) => {
      const input = contactPatch.safeParse(req.body);
      if (!input.success) return reply.code(400).send({ error: input.error.message });
      const row = await db.updateTable("contact").set({ ...input.data, updatedAt: new Date().toISOString() }).where("id", "=", req.params.id).where("bookId", "in", books(req).clearSelect().select("id")).returningAll().executeTakeFirst();
      return row ?? reply.code(404).send({ error: "contact_not_found" });
    });
    routes.delete<{ Params: { id: string } }>("/contacts/:id", async (req, reply) => {
      const row = await db.deleteFrom("contact").where("id", "=", req.params.id).where("bookId", "in", books(req).clearSelect().select("id")).returning("id").executeTakeFirst();
      return row ? { ok: true } : reply.code(404).send({ error: "contact_not_found" });
    });
  });
  return app;
}
