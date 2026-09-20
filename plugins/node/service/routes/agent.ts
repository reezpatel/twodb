import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { TwodbAgentHello, TwodbNodeCommandStatus } from "@twodb/contracts";
import type { NodeDatabase } from "../db";
import { runtime } from "../runtime";
import { hashToken } from "./nodes";
import type {} from "../../shared/fn";

const agentId = (request: FastifyRequest): string => {
  if (!request.nodeId) throw new Error("agent not authenticated");
  return request.nodeId;
};

const bearer = (request: FastifyRequest): string | null => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

const authenticateAgent = async (kysely: Kysely<NodeDatabase>, request: FastifyRequest, reply: FastifyReply) => {
  const token = bearer(request);
  if (!token) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  const rows = await kysely.selectFrom("node_nodes").select("id").where("token_hash", "=", hashToken(token)).limit(1).execute();
  const nodeId = rows[0]?.id;
  if (!nodeId) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  request.nodeId = nodeId;
  return nodeId;
};

export function agentRoutes(kysely: Kysely<NodeDatabase>): (app: FastifyInstance) => Promise<void> {
  return async (app) => {
    app.addHook("preHandler", async (request, reply) => {
      await authenticateAgent(kysely, request, reply);
    });

    app.post<{ Body: TwodbAgentHello }>("/agent/hello", async (request) => {
      const hello = request.body;
      await kysely
        .updateTable("node_nodes")
        .set({
          platform: hello?.platform ?? "unknown",
          hostname: hello?.hostname ?? "",
          arch: hello?.arch ?? "",
          agent_version: hello?.agent_version ?? "",
          labels: hello?.labels ?? {},
          status: "online",
          last_seen_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", agentId(request))
        .execute();
      return { ok: true };
    });

    app.get("/agent/queue", async (request, reply) => {
      const nodeId = agentId(request);
      await kysely.updateTable("node_nodes").set({ status: "online", last_seen_at: new Date() }).where("id", "=", nodeId).execute();

      runtime.attachAgent(nodeId, reply);
      reply.raw.on("close", () => {
        void kysely.updateTable("node_nodes").set({ status: "offline", last_seen_at: new Date() }).where("id", "=", nodeId).execute();
      });
      return reply;
    });

    app.post<{ Params: { id: string } }>("/agent/commands/:id/start", async (request, reply) => {
      const command = await loadCommandRow(kysely, request.params.id, agentId(request));
      if (!command) {
        reply.code(404).send({ error: "command_not_found" });
        return reply;
      }
      await kysely.updateTable("node_commands").set({ status: "running", started_at: new Date() }).where("id", "=", command.id).execute();
      runtime.emit(command.id, { type: "start", at: new Date().toISOString() });
      return { ok: true };
    });

    app.post<{ Params: { id: string }; Body: { stream?: string; data?: string } }>("/agent/commands/:id/chunk", async (request, reply) => {
      const command = await loadCommandRow(kysely, request.params.id, agentId(request));
      if (!command) {
        reply.code(404).send({ error: "command_not_found" });
        return reply;
      }
      const stream = request.body?.stream === "stderr" ? "stderr" : "stdout";
      const data = typeof request.body?.data === "string" ? request.body.data : "";
      if (data.length > 0) {
        runtime.emit(command.id, { type: "chunk", stream, data, at: new Date().toISOString() });
      }
      return { ok: true };
    });

    app.post<{ Params: { id: string }; Body: { status?: string; code?: number | null; signal?: string; error?: string } }>(
      "/agent/commands/:id/exit",
      async (request, reply) => {
        const command = await loadCommandRow(kysely, request.params.id, agentId(request));
        if (!command) {
          reply.code(404).send({ error: "command_not_found" });
          return reply;
        }
        const body = request.body ?? {};
        const status: TwodbNodeCommandStatus = body.status === "error" || body.status === "timeout" || body.status === "cancelled" ? body.status : "done";
        await kysely
          .updateTable("node_commands")
          .set({
            status,
            exit_code: body.code ?? null,
            error: body.error ?? null,
            finished_at: new Date(),
          })
          .where("id", "=", command.id)
          .execute();
        if (status === "error" && body.error) {
          runtime.emit(command.id, { type: "error", error: body.error, at: new Date().toISOString() });
        }
        runtime.emit(command.id, {
          type: "exit",
          code: body.code ?? null,
          signal: body.signal,
          at: new Date().toISOString(),
        });
        return { ok: true };
      },
    );

    app.post<{ Params: { id: string }; Body: { ok?: boolean; hash?: string; error?: string } }>("/agent/patches/:id/result", async (request, reply) => {
      const patch = await kysely
        .selectFrom("node_patches")
        .selectAll()
        .where("id", "=", request.params.id)
        .where("node_id", "=", agentId(request))
        .limit(1)
        .execute();
      if (!patch[0]) {
        reply.code(404).send({ error: "patch_not_found" });
        return reply;
      }
      const body = request.body ?? {};
      const ok = body.ok === true;
      await kysely
        .updateTable("node_patches")
        .set({
          status: ok ? "applied" : "failed",
          hash: body.hash ?? null,
          error: body.error ?? null,
          finished_at: new Date(),
        })
        .where("id", "=", request.params.id)
        .execute();
      runtime.setPatch(request.params.id, {
        status: ok ? "applied" : "failed",
        hash: body.hash ?? null,
        error: body.error ?? null,
        settledAt: Date.now(),
      });
      return { ok: true };
    });

    app.post("/agent/bye", async (request) => {
      await kysely.updateTable("node_nodes").set({ status: "offline", last_seen_at: new Date() }).where("id", "=", agentId(request)).execute();
      return { ok: true };
    });
  };
}

async function loadCommandRow(kysely: Kysely<NodeDatabase>, id: string, nodeId: string) {
  const rows = await kysely.selectFrom("node_commands").select(["id", "node_id"]).where("id", "=", id).where("node_id", "=", nodeId).limit(1).execute();
  return rows[0] ?? null;
}
