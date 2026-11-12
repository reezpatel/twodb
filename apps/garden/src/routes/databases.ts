import type { FastifyInstance } from "fastify";
import { parseRequest, requireScope, HttpError } from "../http.js";
import * as s from "../schemas.js";
import { requireRecord, type Db } from "../store/base.js";
import { databaseDetail, recordDetail } from "../store/records.js";
import { queryRows, updateValues } from "../store/rows.js";
import { createField, createView, deleteField, deleteView, duplicateView, getView, updateField, updateView } from "../store/schema.js";

export function registerDatabaseRoutes(app: FastifyInstance, db: Db) {
  app.get("/databases/:id", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    return databaseDetail(db, requireScope(req), id);
  });

  app.post("/databases/:id/query", async (req) => {
    const scope = requireScope(req);
    const q = parseRequest(s.queryRows, req);
    await requireRecord(db, scope, q.id, { kind: "database", includeDeleted: true });
    let filter = q.filter;
    let sorts = q.sorts;
    if (q.viewId) {
      const view = await getView(db, scope, q.viewId);
      if (view.databaseId !== q.id) throw new HttpError(400, "view_mismatch");
      if (filter === undefined) filter = view.config.filter ?? null;
      if (sorts === undefined) {
        // group-by field sorts first so groups come out contiguous
        sorts = view.config.sorts ?? [];
      }
    }
    return queryRows(db, scope, q.id, { filter, sorts, search: q.search, limit: q.limit, offset: q.offset });
  });

  app.patch("/records/:id/values", async (req) => {
    const scope = requireScope(req);
    const { id, values } = parseRequest(s.patchValues, req);
    const rec = await requireRecord(db, scope, id, { kind: "page" });
    await updateValues(db, scope, rec.database_id!, id, values);
    return recordDetail(db, scope, id);
  });

  app.post("/databases/:id/fields", async (req, reply) => {
    const { id, ...spec } = parseRequest(s.createField, req);
    return reply.code(201).send(await createField(db, requireScope(req), id, spec));
  });

  app.patch("/fields/:id", async (req) => {
    const { id, ...patch } = parseRequest(s.patchField, req);
    return updateField(db, requireScope(req), id, patch);
  });

  app.delete("/fields/:id", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    await deleteField(db, requireScope(req), id);
    return { ok: true };
  });

  app.post("/databases/:id/views", async (req, reply) => {
    const { id, ...spec } = parseRequest(s.createView, req);
    return reply.code(201).send(await createView(db, requireScope(req), id, spec));
  });

  app.patch("/views/:id", async (req) => {
    const { id, ...patch } = parseRequest(s.patchView, req);
    return updateView(db, requireScope(req), id, patch);
  });

  app.post("/views/:id/duplicate", async (req, reply) => {
    const { id } = parseRequest(s.idParam, req);
    return reply.code(201).send(await duplicateView(db, requireScope(req), id));
  });

  app.delete("/views/:id", async (req) => {
    const { id } = parseRequest(s.idParam, req);
    await deleteView(db, requireScope(req), id);
    return { ok: true };
  });
}
