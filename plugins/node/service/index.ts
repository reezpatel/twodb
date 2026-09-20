import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type { Kysely } from "kysely";
import type { TwodbNodeCommand, TwodbNodeCommandStatus } from "@twodb/contracts";
import { readNodeConfig, type NodePluginConfig } from "./config";
import { nodeMigrations, type NodeDatabase } from "./db";
import { registerRoutes } from "./routes";
import { runtime } from "./runtime";

let db: Kysely<NodeDatabase> | null = null;
let configCtx: TwodbContext | null = null;

const requireDb = (): Kysely<NodeDatabase> => {
  if (!db) throw new Error("node plugin not initialized");
  return db;
};

const waitForAgent = async (nodeId: string, config: NodePluginConfig): Promise<boolean> => {
  const deadline = Date.now() + config.offline_wait_ms;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (runtime.agentOnline(nodeId)) return true;
  }
  return runtime.agentOnline(nodeId);
};

const readConfig = (): Promise<NodePluginConfig> => readNodeConfig(configCtx ?? ({ pluginId: "io.twodb.node" } as TwodbContext));

const NodeServicePlugin = {
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    db = ctx.db as unknown as Kysely<NodeDatabase>;
    configCtx = ctx;
    await registerRoutes(ctx, app);
  },

  functions: {
    "node.runCommand": async (input: { nodeId: string; command: string; cwd?: string | null; timeoutMs?: number | null }) => {
      const commandId = (
        await requireDb()
          .insertInto("node_commands")
          .values({
            node_id: input.nodeId,
            command: input.command,
            cwd: input.cwd ?? null,
            exit_code: null,
            error: null,
            workspace_id: null,
            user_id: null,
            started_at: null,
            finished_at: null,
          })
          .returning("id")
          .execute()
      )[0].id;

      const sent =
        runtime.sendToAgent(input.nodeId, {
          kind: "command",
          id: commandId,
          command: input.command,
          cwd: input.cwd ?? null,
          timeout_ms: Math.min(Math.max(input.timeoutMs ?? 60_000, 1_000), 600_000),
        }) ||
        ((await waitForAgent(input.nodeId, await readConfig())) &&
          runtime.sendToAgent(input.nodeId, {
            kind: "command",
            id: commandId,
            command: input.command,
            cwd: input.cwd ?? null,
            timeout_ms: Math.min(Math.max(input.timeoutMs ?? 60_000, 1_000), 600_000),
          }));
      if (!sent) {
        await requireDb()
          .updateTable("node_commands")
          .set({ status: "error", error: "node_offline", finished_at: new Date() })
          .where("id", "=", commandId)
          .execute();
      }
      return { commandId };
    },

    "node.commandStatus": async (commandId: string) => {
      const rows = await requireDb().selectFrom("node_commands").selectAll().where("id", "=", commandId).limit(1).execute();
      const row = rows[0];
      if (!row) return null;
      const command: TwodbNodeCommand = {
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
      };
      return { command, output: runtime.output(commandId) };
    },

    "node.patch": async (input: {
      nodeId: string;
      path: string;
      baseHash?: string | null;
      ops: Array<{ start: number; delete_count: number; lines: string[] }>;
    }) => {
      const patchId = (
        await requireDb()
          .insertInto("node_patches")
          .values({ node_id: input.nodeId, path: input.path, hash: null, error: null, finished_at: null })
          .returning("id")
          .execute()
      )[0].id;
      runtime.setPatch(patchId, { status: "pending", hash: null, error: null, settledAt: null });
      const sent =
        runtime.sendToAgent(input.nodeId, {
          kind: "patch",
          id: patchId,
          path: input.path,
          base_hash: input.baseHash ?? null,
          ops: input.ops,
        }) ||
        ((await waitForAgent(input.nodeId, await readConfig())) &&
          runtime.sendToAgent(input.nodeId, {
            kind: "patch",
            id: patchId,
            path: input.path,
            base_hash: input.baseHash ?? null,
            ops: input.ops,
          }));
      if (!sent) {
        runtime.setPatch(patchId, { status: "failed", hash: null, error: "node_offline", settledAt: Date.now() });
        await requireDb()
          .updateTable("node_patches")
          .set({ status: "failed", error: "node_offline", finished_at: new Date() })
          .where("id", "=", patchId)
          .execute();
      }
      return { patchId };
    },

    "node.patchStatus": async (patchId: string) => {
      const live = runtime.patch(patchId);
      if (live) {
        return { status: live.status as "pending" | "applied" | "failed", hash: live.hash, error: live.error };
      }
      const rows = await requireDb().selectFrom("node_patches").select(["status", "hash", "error"]).where("id", "=", patchId).limit(1).execute();
      const row = rows[0];
      return row ? { status: row.status as "pending" | "applied" | "failed", hash: row.hash, error: row.error } : null;
    },
  },

  migrations: nodeMigrations,
} satisfies ServicePlugin;

export default NodeServicePlugin;
