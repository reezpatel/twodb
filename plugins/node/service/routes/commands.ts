import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { TwodbNodeCommand, TwodbNodeCommandStatus } from "@twodb/contracts";
import type { NodeDatabase } from "../db";
import type {} from "@twodb/workspace/shared/fn";
import { runtime } from "../runtime";
import { loadNode } from "./nodes";
import type { RunCommandRequest } from "../../shared/api";

type CommandRow = {
  id: string;
  node_id: string;
  command: string;
  cwd: string | null;
  status: string;
  exit_code: number | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

const toCommand = (row: CommandRow): TwodbNodeCommand => ({
  id: row.id,
  node_id: row.node_id,
  command: row.command,
  cwd: row.cwd,
  status: row.status as TwodbNodeCommandStatus,
  exit_code: row.exit_code,
  error: row.error,
  created_at: row.created_at.toISOString(),
  started_at: row.started_at ? row.started_at.toISOString() : null,
  finished_at: row.finished_at ? row.finished_at.toISOString() : null,
});

export async function loadCommand(kysely: Kysely<NodeDatabase>, id: string): Promise<CommandRow | null> {
  const rows = await kysely.selectFrom("node_commands").selectAll().where("id", "=", id).limit(1).execute();
  return (rows[0] as CommandRow | undefined) ?? null;
}

export function commandRoutes(kysely: Kysely<NodeDatabase>): (app: FastifyInstance) => Promise<void> {
  return async (app) => {
    app.addHook("preHandler", async (request, reply) => {
      if (!request.userId) {
        reply.code(401).send({ error: "unauthorized" });
        return reply;
      }
    });

    app.post<{ Params: { id: string }; Body: RunCommandRequest }>("/nodes/:id/commands", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      const command = request.body?.command?.trim();
      if (!command) {
        reply.code(400).send({ error: "invalid_request" });
        return reply;
      }
      if (!runtime.agentOnline(node.id)) {
        reply.code(409).send({ error: "node_offline" });
        return reply;
      }

      const timeoutMs = Math.min(Math.max(request.body.timeout_ms ?? 60_000, 1_000), 600_000);
      const rows = await kysely
        .insertInto("node_commands")
        .values({
          node_id: node.id,
          command,
          cwd: request.body.cwd ?? null,
          exit_code: null,
          error: null,
          workspace_id: request.workspaceId ?? null,
          user_id: request.userId,
          started_at: null,
          finished_at: null,
        })
        .returningAll()
        .execute();

      const row = rows[0] as CommandRow;
      runtime.sendToAgent(node.id, {
        kind: "command",
        id: row.id,
        command,
        cwd: row.cwd,
        timeout_ms: timeoutMs,
      });
      return { command: toCommand(row) };
    });

    app.get<{ Params: { id: string } }>("/commands/:id", async (request, reply) => {
      const command = await loadCommand(kysely, request.params.id);
      if (!command) {
        reply.code(404).send({ error: "command_not_found" });
        return reply;
      }
      return { command: toCommand(command), output: runtime.output(command.id) };
    });

    app.get<{ Params: { id: string } }>("/commands/:id/stream", async (request, reply) => {
      const command = await loadCommand(kysely, request.params.id);
      if (!command) {
        reply.code(404).send({ error: "command_not_found" });
        return reply;
      }
      runtime.subscribe(command.id, reply);
      return reply;
    });

    app.post<{ Params: { id: string } }>("/commands/:id/kill", async (request, reply) => {
      const command = await loadCommand(kysely, request.params.id);
      if (!command) {
        reply.code(404).send({ error: "command_not_found" });
        return reply;
      }
      const sent = runtime.sendToAgent(command.node_id, { kind: "kill", id: command.id });
      return { ok: sent, error: sent ? null : "node_offline" };
    });

    app.get<{ Params: { id: string }; Querystring: { limit?: string } }>("/nodes/:id/commands", async (request, reply) => {
      const node = await loadNode(kysely, request.params.id);
      if (!node) {
        reply.code(404).send({ error: "node_not_found" });
        return reply;
      }
      const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 100);
      const rows = await kysely.selectFrom("node_commands").selectAll().where("node_id", "=", node.id).orderBy("created_at", "desc").limit(limit).execute();
      return { commands: rows.map((row) => toCommand(row as CommandRow)) };
    });
  };
}
