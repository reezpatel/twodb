import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRequest, requireScope } from "../http.js";
import { readForwardedContext } from "../gateway-context.js";
import * as s from "../schemas.js";
import type { Db } from "../store/base.js";
import { children, createDatabase, createPage, databaseDetail, patchRecord, recordDetail, tree } from "../store/records.js";
import { backlinks, deletePermanently, emptyTrash, listTrash, restoreRecord, search, trashRecord } from "../store/trash.js";

export function registerRecordRoutes(app: FastifyInstance, db: Db) {
  app.get("/tree", async (req) => tree(db, requireScope(req)));

  app.get("/records/:id/children", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    return { nodes: await children(db, requireScope(req), id) };
  });

  app.post("/pages", async (req, reply) => {
    const scope = requireScope(req);
    const body = parseRequest(s.createPage, req);
    const id = await createPage(db, scope, body);
    return reply.code(201).send(await recordDetail(db, scope, id));
  });

  app.post("/databases", async (req, reply) => {
    const scope = requireScope(req);
    const body = parseRequest(s.createDatabase, req);
    const id = await createDatabase(db, scope, body);
    return reply.code(201).send(await databaseDetail(db, scope, id));
  });

  app.get("/records/:id", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    return recordDetail(db, requireScope(req), id);
  });

  app.patch("/records/:id", async (req) => {
    const { id, ...patch } = parseRequest(s.patchRecord, req);
    await patchRecord(db, requireScope(req), id, patch);
    return { ok: true };
  });

  app.delete("/records/:id", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    await trashRecord(db, requireScope(req), id);
    return { ok: true };
  });

  app.post("/records/:id/restore", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    await restoreRecord(db, requireScope(req), id);
    return { ok: true };
  });

  app.delete("/records/:id/permanent", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    await deletePermanently(db, requireScope(req), id);
    return { ok: true };
  });

  app.get("/records/:id/backlinks", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    return { backlinks: await backlinks(db, requireScope(req), id) };
  });

  app.get("/search", async (req) => {
    const q = parseRequest(s.searchQuery, req);
    return { hits: await search(db, requireScope(req), q.q, q) };
  });

  app.post("/federated-search", async (req) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return { results: [] };
    const { query } = parseRequest(z.object({ query: z.string().default("") }), req);
    const spaces = ctx.spaceIds.length ? ctx.spaceIds : ["default"];
    const results = [];
    for (const spaceId of spaces) {
      const hits = await search(db, { workspaceId: ctx.workspaceId, spaceId, actor: ctx.actor, userId: ctx.userId }, query, { limit: 10 });
      results.push(...hits.map((h) => ({ id: h.id, kind: h.kind, title: h.title || "Untitled", snippet: h.snippet, spaceId, url: `/apps/garden/${h.id}` })));
    }
    return { results };
  });

  app.get("/trash", async (req) => ({ items: await listTrash(db, requireScope(req)) }));
  app.delete("/trash", async (req) => {
    await emptyTrash(db, requireScope(req));
    return { ok: true };
  });
}
