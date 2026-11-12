import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulid } from "ulid";
import type { StorageAdapter } from "@twodb/core-data/storage";
import { CARDINALITIES, EDGE_KINDS } from "../shared/model.js";
import { GROUP_STYLES, SHAPES } from "../shared/shapes.js";
import { ICON_SETS, iconSvg, searchIcons } from "../icons.js";
import { HttpError, type Store } from "../store.js";
import { parseRequest, requireCtx } from "../http.js";
import { assetKey } from "../storage.js";

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

export function registerMiscRoutes(app: FastifyInstance, store: Store, blobs: StorageAdapter): void {
  app.get("/icons/search", async (req) => {
    requireCtx(req);
    const q = parseRequest(
      z.object({ q: z.string(), set: z.enum(["logos", "gcp", "carbon", "mdi"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }),
      req,
    );
    return { icons: searchIcons(q.q, { set: q.set, limit: q.limit }) };
  });

  app.get("/icons/:set/:name", async (req, reply) => {
    requireCtx(req);
    const q = parseRequest(z.object({ set: z.string(), name: z.string(), color: z.string().max(30).optional() }), req);
    const svg = iconSvg(q.set, q.name.replace(/\.svg$/, ""), q.color);
    if (!svg) throw new HttpError(404, "icon_not_found");
    return reply.header("content-type", "image/svg+xml").header("cache-control", "private, max-age=86400").send(svg);
  });

  app.get("/catalog", async (req) => {
    requireCtx(req);
    return {
      shapes: SHAPES.map((s) => ({ pack: s.pack, id: s.id, label: s.label, width: s.w, height: s.h })),
      groupStyles: GROUP_STYLES,
      edgeKinds: [...EDGE_KINDS],
      cardinalities: [...CARDINALITIES],
      iconSets: ICON_SETS,
    };
  });

  // ----------------------------------------------------------------- assets
  app.post("/boards/:id/assets", async (req, reply) => {
    const ctx = requireCtx(req);
    const { id: boardId } = parseRequest(z.object({ id: z.string() }), req);
    const board = await store.getBoardRow(boardId, ctx.workspaceId);
    if (board.kind !== "diagram") throw new HttpError(400, "not_a_diagram_board");
    const file = await req.file({ limits: { fileSize: MAX_ASSET_BYTES, files: 1 } });
    if (!file) throw new HttpError(400, "file_required", "send multipart/form-data with a `file` field");
    const contentType = file.mimetype;
    if (!IMAGE_TYPES.has(contentType)) throw new HttpError(415, "unsupported_type", `allowed: ${[...IMAGE_TYPES].join(", ")}`);
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new HttpError(413, "too_large", "max 10 MB");
    const id = ulid();
    await blobs.put(assetKey(ctx.workspaceId, boardId, id), buf, { contentType });
    await store.db
      .insertInto("assets")
      .values({ id, board_id: boardId, workspace_id: ctx.workspaceId, s3_key: assetKey(ctx.workspaceId, boardId, id), content_type: contentType, size: buf.length, name: file.filename ?? "", created_by: ctx.actor } as never)
      .execute();
    return reply.code(201).send({ id, contentType, size: buf.length, name: file.filename ?? "" });
  });

  app.get("/assets/:assetId", async (req, reply) => {
    const ctx = requireCtx(req);
    const { assetId } = parseRequest(z.object({ assetId: z.string() }), req);
    const row = await store.db.selectFrom("assets").selectAll().where("id", "=", assetId).executeTakeFirst();
    if (!row || row.workspace_id !== ctx.workspaceId) throw new HttpError(404, "asset_not_found");
    const stream = await blobs.getStream(row.s3_key);
    return reply
      .header("content-type", row.content_type)
      .header("cache-control", "private, max-age=3600")
      // SVG uploads can carry script; never let them execute when opened directly.
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      .header("x-content-type-options", "nosniff")
      .send(stream);
  });
}
