import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { createHash, randomBytes } from "node:crypto";
import type { TwodbNodeInfo, TwodbNodePlatform, TwodbNodeStatus } from "@twodb/contracts";
import type { NodeDatabase } from "../db";
import type {} from "@twodb/auth/shared/fn";
import type { CreatedNode, CreateNodeRequest, UpdateNodeRequest } from "../../shared/api";

type NodeRow = {
  id: string;
  name: string;
  platform: string;
  hostname: string;
  arch: string;
  agent_version: string;
  labels: Record<string, string> | null;
  status: string;
  last_seen_at: Date | null;
  token_hash: string;
  created_at: Date;
};

export const toNodeInfo = (row: NodeRow): TwodbNodeInfo => ({
  id: row.id,
  name: row.name,
  platform: (row.platform as TwodbNodePlatform) ?? "unknown",
  hostname: row.hostname,
  arch: row.arch,
  agent_version: row.agent_version,
  labels: row.labels ?? {},
  status: (row.status as TwodbNodeStatus) ?? "unknown",
  last_seen_at: row.last_seen_at ? row.last_seen_at.toISOString() : null,
  created_at: row.created_at.toISOString(),
});

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const newToken = (): string => randomBytes(32).toString("base64url");

export async function loadNode(kysely: Kysely<NodeDatabase>, id: string): Promise<NodeRow | null> {
  const rows = await kysely.selectFrom("node_nodes").selectAll().where("id", "=", id).limit(1).execute();
  return (rows[0] as NodeRow | undefined) ?? null;
}

export function nodeRoutes(kysely: Kysely<NodeDatabase>): (app: FastifyInstance) => Promise<void> {
  return async (app) => {
    app.addHook("preHandler", async (request, reply) => {
      if (!request.userId) {
        reply.code(401).send({ error: "unauthorized" });
        return reply;
      }
    });

    app.get("/nodes", async () => {
      const rows = await kysely.selectFrom("node_nodes").selectAll().orderBy("created_at").execute();
      return { nodes: rows.map((row) => toNodeInfo(row as NodeRow)) };
    });

    app.post<{ Body: CreateNodeRequest }>("/nodes", async (request, reply) => {
      const name = request.body?.name?.trim();
      if (!name) {
        reply.code(400).send({ error: "invalid_request" });
        return reply;
      }
      const token = newToken();
      const rows = await kysely
        .insertInto("node_nodes")
        .values({
          name,
          labels: request.body.labels ?? {},
          token_hash: hashToken(token),
        })
        .returningAll()
        .execute();
      const created: CreatedNode = { node: toNodeInfo(rows[0] as NodeRow), token };
      return created;
    });

    app.patch<{ Params: { id: string }; Body: UpdateNodeRequest }>("/nodes/:id", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      const body = request.body ?? {};
      const rows = await kysely
        .updateTable("node_nodes")
        .set({
          ...(body.name != null ? { name: body.name.trim() } : {}),
          ...(body.labels != null ? { labels: body.labels } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", node.id)
        .returningAll()
        .execute();
      return { node: toNodeInfo(rows[0] as NodeRow) };
    });

    app.post<{ Params: { id: string } }>("/nodes/:id/token", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      const token = newToken();
      await kysely
        .updateTable("node_nodes")
        .set({ token_hash: hashToken(token), updated_at: new Date() })
        .where("id", "=", node.id)
        .execute();
      return { token };
    });

    app.delete<{ Params: { id: string } }>("/nodes/:id", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      await kysely.deleteFrom("node_nodes").where("id", "=", node.id).execute();
      return { ok: true };
    });
  };
}
