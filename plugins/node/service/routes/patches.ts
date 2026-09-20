import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { TwodbNodePatch, TwodbNodePatchStatus } from "@twodb/contracts";
import type { NodeDatabase } from "../db";
import { runtime } from "../runtime";
import { loadNode } from "./nodes";
import type { PatchRequest } from "../../shared/api";

type PatchRow = {
  id: string;
  node_id: string;
  path: string;
  status: string;
  hash: string | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
};

const toPatch = (row: PatchRow): TwodbNodePatch => ({
  id: row.id,
  node_id: row.node_id,
  path: row.path,
  status: row.status as TwodbNodePatchStatus,
  hash: row.hash,
  error: row.error,
  created_at: row.created_at.toISOString(),
  finished_at: row.finished_at ? row.finished_at.toISOString() : null,
});

async function loadPatch(kysely: Kysely<NodeDatabase>, id: string): Promise<PatchRow | null> {
  const rows = await kysely.selectFrom("node_patches").selectAll().where("id", "=", id).limit(1).execute();
  return (rows[0] as PatchRow | undefined) ?? null;
}

export function patchRoutes(kysely: Kysely<NodeDatabase>): (app: FastifyInstance) => Promise<void> {
  return async (app) => {
    app.addHook("preHandler", async (request, reply) => {
      if (!request.userId) {
        reply.code(401).send({ error: "unauthorized" });
        return reply;
      }
    });

    app.post<{ Params: { id: string }; Body: PatchRequest }>("/nodes/:id/patch", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      const body = request.body;
      if (!body?.path || !Array.isArray(body.ops) || body.ops.length === 0) {
        reply.code(400).send({ error: "invalid_request" });
        return reply;
      }
      if (!runtime.agentOnline(node.id)) {
        reply.code(409).send({ error: "node_offline" });
        return reply;
      }

      const rows = await kysely
        .insertInto("node_patches")
        .values({
          node_id: node.id,
          path: body.path,
          hash: null,
          error: null,
          finished_at: null,
        })
        .returningAll()
        .execute();
      const row = rows[0] as PatchRow;
      runtime.setPatch(row.id, { status: "pending", hash: null, error: null, settledAt: null });
      runtime.sendToAgent(node.id, {
        kind: "patch",
        id: row.id,
        path: body.path,
        base_hash: body.base_hash ?? null,
        ops: body.ops,
      });
      return { patch: toPatch(row) };
    });

    app.get<{ Params: { id: string } }>("/patches/:id", async (request, reply) => {
      const patch = await loadPatch(kysely, request.params.id);
      if (!patch) {
        reply.code(404).send({ error: "patch_not_found" });
        return reply;
      }
      const live = runtime.patch(patch.id);
      if (live) {
        return {
          patch: {
            ...toPatch(patch),
            status: live.status,
            hash: live.hash,
            error: live.error,
            finished_at: live.settledAt ? new Date(live.settledAt).toISOString() : null,
          },
        };
      }
      return { patch: toPatch(patch) };
    });
  };
}
