// Agent-facing builders: describe a diagram, the server computes the geometry.
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { DiagramRequest, ErdRequest, LayoutRequest, MermaidRequest, ProcessRequest, type BuildResult } from "../shared/dto.js";
import type { Item } from "../shared/model.js";
import { HttpError, type Store } from "../store.js";
import { parseRequest, requireCtx } from "../http.js";
import { buildDiagram } from "../builders/diagram.js";
import { buildErd } from "../builders/erd.js";
import { buildProcess } from "../builders/process.js";
import { buildRelayout } from "../builders/relayout.js";
import { describeBoard } from "../builders/describe.js";
import { MermaidError, parseMermaid } from "../builders/mermaid.js";
import type { Plan } from "../builders/reconcile.js";
import { rowToBoard } from "../store.js";

const id = z.object({ id: z.string() });

export function registerBuildRoutes(app: FastifyInstance, store: Store): void {
  /** Load context, run the builder, commit one batch. */
  async function run(
    req: Parameters<typeof requireCtx>[0],
    boardId: string,
    label: string,
    build: (existing: Item[]) => Promise<Plan>,
    userLabel?: string,
  ): Promise<BuildResult> {
    const ctx = requireCtx(req);
    const board = await store.getBoardRow(boardId, ctx.workspaceId);
    if (board.kind !== "diagram") throw new HttpError(400, "not_a_diagram_board");
    const existing = await store.listItems(boardId);
    let plan: Plan;
    try {
      plan = await build(existing);
    } catch (e) {
      if (e instanceof MermaidError || e instanceof ZodError || (e instanceof Error && e.constructor === Error)) throw new HttpError(400, "invalid_diagram", e.message);
      throw e;
    }
    if (!plan.ops.length) throw new HttpError(400, "empty_diagram", "nothing to build");
    const res = await store.applyBatch(boardId, ctx.workspaceId, ctx.actor, { ops: plan.ops, label: userLabel ?? label });
    return {
      seq: res.seq,
      batchId: res.batchId,
      keyToId: plan.keyToId,
      created: plan.created,
      updated: plan.updated,
      deleted: plan.deleted,
      warnings: [...plan.warnings, ...res.skipped],
      items: res.upserts,
      inverse: res.inverse,
    };
  }

  app.post("/boards/:id/diagram", async (req) => {
    const b = parseRequest(id.extend(DiagramRequest.shape), req);
    return run(req, b.id, `AI: diagram (${b.nodes.length} nodes, ${b.edges.length} links)`, (ex) => buildDiagram(b, ex), b.label);
  });

  app.post("/boards/:id/erd", async (req) => {
    const b = parseRequest(id.extend(ErdRequest.shape), req);
    return run(req, b.id, `AI: ER diagram (${b.entities.length} tables)`, (ex) => buildErd(b, ex), b.label);
  });

  app.post("/boards/:id/process", async (req) => {
    const b = parseRequest(id.extend(ProcessRequest.shape), req);
    return run(req, b.id, `AI: process map (${b.steps.length} steps)`, (ex) => buildProcess(b, ex), b.label);
  });

  app.post("/boards/:id/mermaid", async (req) => {
    const b = parseRequest(id.extend(MermaidRequest.shape), req);
    return run(
      req,
      b.id,
      "AI: imported Mermaid",
      async (ex) => {
        const parsed = parseMermaid(b.source);
        if (parsed.type === "flowchart") {
          const d = parsed.diagram;
          return buildDiagram(DiagramRequest.parse({ ...d, direction: b.direction ?? d.direction, mode: b.mode, origin: b.origin }), ex);
        }
        return buildErd(ErdRequest.parse({ ...parsed.erd, direction: b.direction ?? "LR", mode: b.mode, origin: b.origin }), ex);
      },
      b.label,
    );
  });

  app.post("/boards/:id/layout", async (req) => {
    const ctx = requireCtx(req);
    const b = parseRequest(id.extend(LayoutRequest.shape), req);
    const board = await store.getBoardRow(b.id, ctx.workspaceId);
    if (board.kind !== "diagram") throw new HttpError(400, "not_a_diagram_board");
    const items = await store.listItems(b.id);
    const { ops, warnings } = await buildRelayout(b, items);
    if (!ops.length) return { seq: Number(board.last_seq), batchId: "", keyToId: {}, created: 0, updated: 0, deleted: 0, warnings, items: [] };
    const res = await store.applyBatch(b.id, ctx.workspaceId, ctx.actor, { ops, label: b.label ?? "Tidy up" });
    return { seq: res.seq, batchId: res.batchId, keyToId: {}, created: 0, updated: ops.length, deleted: 0, warnings: [...warnings, ...res.skipped], items: res.upserts, inverse: res.inverse };
  });

  app.get("/boards/:id/describe", async (req) => {
    const ctx = requireCtx(req);
    const { id: boardId } = parseRequest(id, req);
    const row = await store.getBoardRow(boardId, ctx.workspaceId);
    const board = rowToBoard(row);
    const items = board.kind === "diagram" ? await store.listItems(boardId) : [];
    return { ...describeBoard(board, items, row.doc_markdown), seq: board.lastSeq };
  });
}
