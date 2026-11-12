import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, notFound, parseRequest, requireScope } from "../http.js";
import * as s from "../schemas.js";
import type { Db } from "../store/base.js";
import { getRecord } from "../store/base.js";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif"]);

export function registerAssetRoutes(app: FastifyInstance, db: Db, maxBytes: number) {
  // Raw image bodies.
  app.addContentTypeParser(/^image\//, { parseAs: "buffer", bodyLimit: maxBytes }, (_req, body, done) => done(null, body));

  app.post("/assets", async (req, reply) => {
    const scope = requireScope(req);
    const { recordId } = parseRequest(z.object({ recordId: s.uuid.optional() }), req);
    const type = String(req.headers["content-type"] ?? "").split(";")[0].trim();
    if (!IMAGE_TYPES.has(type)) throw new HttpError(415, "unsupported_media_type");
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) throw new HttpError(400, "empty_body");
    if (recordId && !(await getRecord(db, scope, recordId))) throw notFound();
    const id = crypto.randomUUID();
    const name = decodeURIComponent(String(req.headers["x-file-name"] ?? "")).slice(0, 200);
    await db
      .insertInto("asset")
      .values({ id, workspace_id: scope.workspaceId, record_id: recordId ?? null, name, content_type: type, size: data.length, data, created_by: scope.actor, created_at: new Date() })
      .execute();
    return reply.code(201).send({ id, url: `/apps/garden/assets/${id}` });
  });

  app.get("/assets/:id", async (req, reply) => {
    const scope = requireScope(req);
    const { id } = parseRequest(s.idParam, req);
    const a = await db.selectFrom("asset").select(["content_type", "data"]).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (!a) throw notFound("asset");
    return reply
      .header("content-type", a.content_type)
      .header("cache-control", "private, max-age=31536000, immutable")
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
      .send(a.data);
  });
}
