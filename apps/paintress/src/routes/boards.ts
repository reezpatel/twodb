import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BatchRequest, CreateBoard, ItemPatch, NewItem, Op } from "../shared/model.js";
import { HttpError, rowToBoard, type Store } from "../store.js";
import { parseRequest, requireCtx } from "../http.js";
import { applyDocOps, DocOpError, type DocOp } from "../doc-ops.js";

const id = z.object({ id: z.string() });

export function registerBoardRoutes(app: FastifyInstance, store: Store): void {
  app.get("/boards", async (req) => {
    const ctx = requireCtx(req);
    const q = parseRequest(z.object({ spaceId: z.string().optional() }), req);
    return { boards: await store.listBoards(ctx.workspaceId, q.spaceId ? [q.spaceId] : undefined) };
  });

  app.post("/boards", async (req, reply) => {
    const ctx = requireCtx(req);
    const b = parseRequest(CreateBoard, req);
    // Space is a label on the board; it must be one the caller belongs to.
    const spaceId = b.spaceId ?? ctx.spaceIds[0];
    if (!spaceId) throw new HttpError(400, "space_required", "spaceId is required (the caller has no default space)");
    if (ctx.spaceIds.length && !ctx.spaceIds.includes(spaceId)) throw new HttpError(403, "forbidden_space");
    const board = await store.createBoard({
      workspaceId: ctx.workspaceId,
      spaceId,
      actor: ctx.actor,
      name: b.name,
      kind: b.kind,
      description: b.description,
      markdown: b.markdown,
    });
    return reply.code(201).send(board);
  });

  app.get("/boards/:id", async (req) => {
    const ctx = requireCtx(req);
    const { id: boardId } = parseRequest(id, req);
    const row = await store.getBoardRow(boardId, ctx.workspaceId);
    const board = rowToBoard(row);
    return {
      board,
      items: board.kind === "diagram" ? await store.listItems(boardId) : [],
      doc: board.kind === "doc" ? { markdown: row.doc_markdown, version: row.doc_version } : null,
    };
  });

  app.patch("/boards/:id", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend({ name: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional() }), req);
    return store.updateBoard(b.id, ctx.workspaceId, { name: b.name, description: b.description });
  });

  app.delete("/boards/:id", async (req) => {
    const ctx = requireCtx(req);
    const { id: boardId } = parseRequest(id, req);
    await store.deleteBoard(boardId, ctx.workspaceId);
    return { ok: true };
  });

  // ------------------------------------------------------------------ items
  app.get("/boards/:id/items", async (req) => {
    const ctx = requireCtx(req);
    const q = parseRequest(id.extend({ type: z.string().optional(), parentId: z.string().optional() }), req);
    await store.getBoardRow(q.id, ctx.workspaceId);
    return { items: await store.listItems(q.id, { type: q.type, parentId: q.parentId }) };
  });

  app.post("/boards/:id/ops", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend(BatchRequest.shape), req);
    return store.applyBatch(b.id, ctx.workspaceId, ctx.actor, b);
  });

  app.post("/boards/:id/items", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend({ items: z.array(NewItem).min(1).max(2000), label: z.string().max(200).optional() }), req);
    return store.applyBatch(b.id, ctx.workspaceId, ctx.actor, { ops: b.items.map((item) => ({ op: "create" as const, item })), label: b.label });
  });

  app.patch("/boards/:id/items/:itemId", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(
      id.extend({ itemId: z.string(), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }).extend(ItemPatch.shape),
      req,
    );
    const { id: boardId, itemId, ifVersion, label, ...patch } = b;
    const res = await store.applyBatch(boardId, ctx.workspaceId, ctx.actor, { ops: [{ op: "update", id: itemId, patch, ifVersion }], label });
    if (res.skipped.length && !res.upserts.length) throw new HttpError(res.skipped[0]!.includes("conflict") ? 409 : 404, "not_applied", res.skipped[0]);
    return res;
  });

  app.delete("/boards/:id/items/:itemId", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend({ itemId: z.string() }), req);
    const res = await store.applyBatch(b.id, ctx.workspaceId, ctx.actor, { ops: [{ op: "delete", id: b.itemId }] });
    if (res.skipped.length && !res.deletes.length) throw new HttpError(404, "item_not_found");
    return res;
  });

  // ----------------------------------------------------------------- events
  app.get("/boards/:id/events", async (req) => {
    const ctx = requireCtx(req);
    const q = parseRequest(id.extend({ since: z.coerce.number().int().default(0) }), req);
    await store.getBoardRow(q.id, ctx.workspaceId);
    return { events: await store.eventsSince(q.id, q.since) };
  });

  app.post("/boards/:id/events/:seq/undo", async (req) => {
    const ctx = requireCtx(req);
    const q = parseRequest(id.extend({ seq: z.coerce.number().int() }), req);
    await store.getBoardRow(q.id, ctx.workspaceId);
    const [ev] = (await store.eventsSince(q.id, q.seq - 1, 1)).filter((e) => e.seq === q.seq);
    if (!ev) throw new HttpError(404, "event_not_found");
    if (!ev.inverse.length) throw new HttpError(400, "nothing_to_undo", "this event has no inverse ops");
    return store.applyBatch(q.id, ctx.workspaceId, ctx.actor, { ops: Op.array().parse(ev.inverse), label: `Undo: ${ev.label ?? `change #${ev.seq}`}` });
  });

  // -------------------------------------------------------------------- doc
  app.get("/boards/:id/doc", async (req) => {
    const ctx = requireCtx(req);
    const { id: boardId } = parseRequest(id, req);
    const row = await store.getBoardRow(boardId, ctx.workspaceId);
    if (row.kind !== "doc") throw new HttpError(400, "not_a_doc_board");
    return { markdown: row.doc_markdown, version: row.doc_version };
  });

  app.put("/boards/:id/doc", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend({ markdown: z.string().max(2_000_000), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }), req);
    return store.applyDoc(b.id, ctx.workspaceId, ctx.actor, null, b.markdown, b.ifVersion, b.label);
  });

  app.patch("/boards/:id/doc", async (req) => {
    const ctx = requireCtx(req);
    const DocOpSchema = z.discriminatedUnion("op", [
      z.object({ op: z.literal("append"), markdown: z.string() }),
      z.object({ op: z.literal("prepend"), markdown: z.string() }),
      z.object({ op: z.literal("replace_section"), heading: z.string(), markdown: z.string() }),
      z.object({ op: z.literal("replace"), find: z.string(), with: z.string(), all: z.boolean().optional() }),
    ]);
    const b = parseRequest(id.extend({ ops: z.array(DocOpSchema).min(1), ifVersion: z.number().int().optional(), label: z.string().max(200).optional() }), req);
    const row = await store.getBoardRow(b.id, ctx.workspaceId);
    if (row.kind !== "doc") throw new HttpError(400, "not_a_doc_board");
    if (b.ifVersion !== undefined && b.ifVersion !== row.doc_version) throw new HttpError(409, "version_conflict", `doc is at version ${row.doc_version}`);
    let markdown: string;
    try {
      markdown = applyDocOps(row.doc_markdown, b.ops as DocOp[]);
    } catch (e) {
      if (e instanceof DocOpError) throw new HttpError(422, "doc_op_failed", e.message);
      throw e;
    }
    // Guard on the version we edited so a concurrent write turns into a 409 instead of a lost update.
    const r = await store.applyDoc(b.id, ctx.workspaceId, ctx.actor, null, markdown, row.doc_version, b.label);
    return { ...r, markdown };
  });
}
