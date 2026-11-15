import type { Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { sql } from "kysely";
import type { ToolkitDb, McpServerRow, ConnectorInstanceRow, EventQueueRow, EventQueueItemRow, BroadcastRow, ConnectorStateRow } from "./schema.js";
import { encryptSecret, decryptSecret } from "../crypto.js";
import type { ConnectorTemplate } from "../connectors/types.js";

const now = () => new Date().toISOString();

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function createToolkitRepo(db: Kysely<ToolkitDb>, encryptionKey: string) {
  // --- MCP servers ---------------------------------------------------------
  const mcp = {
    async list(workspaceId: string): Promise<McpServerRow[]> {
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).orderBy("name").execute();
    },
    async get(workspaceId: string, id: string): Promise<McpServerRow | undefined> {
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },
    async getByName(workspaceId: string, name: string): Promise<McpServerRow | undefined> {
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).where("name", "=", name).executeTakeFirst();
    },
    async create(input: { workspaceId: string; name: string; url: string; transport: string; headers: Record<string, string>; enabled: boolean; scopeAll: boolean; scopeIds: string[]; agentIds?: string[] }): Promise<McpServerRow> {
      const row: McpServerRow = {
        id: ulid(), workspace_id: input.workspaceId, name: input.name, url: input.url, transport: input.transport,
        headers_json: JSON.stringify(input.headers), enabled: input.enabled ? 1 : 0,
        scope_mode: input.scopeAll ? "all" : "spaces", scope_all: input.scopeAll ? 1 : 0, scope_ids_json: JSON.stringify(input.scopeIds),
        agent_ids_json: JSON.stringify(input.agentIds ?? []),
        created_at: now(), updated_at: now(),
      };
      await db.insertInto("mcp_server").values(row as any).execute();
      return row;
    },
    async update(workspaceId: string, id: string, patch: Partial<Pick<McpServerRow, "name" | "url" | "transport" | "headers_json" | "enabled" | "scope_mode" | "scope_all" | "scope_ids_json" | "agent_ids_json">>): Promise<McpServerRow | undefined> {
      const row = await db.updateTable("mcp_server").set({ ...patch, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).returningAll().executeTakeFirst();
      return row;
    },
    async remove(workspaceId: string, id: string): Promise<void> {
      await db.deleteFrom("mcp_server").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },
  };

  // --- Connector instances -------------------------------------------------
  function encryptConfig(template: ConnectorTemplate, config: Record<string, string>): string {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      const field = template.fields.find((f) => f.key === k);
      out[k] = field?.secret ? encryptSecret(v, encryptionKey) : v;
    }
    return JSON.stringify(out);
  }

  const instances = {
    rowToInstance(row: ConnectorInstanceRow, template: ConnectorTemplate): { config: Record<string, string>; live: boolean } {
      const stored = parseJson<Record<string, string>>(row.config_json, {});
      return { config: stored, live: false };
    },
    async list(workspaceId: string): Promise<ConnectorInstanceRow[]> {
      return db.selectFrom("connector_instance").selectAll().where("workspace_id", "=", workspaceId).orderBy("created_at").execute();
    },
    async get(workspaceId: string, id: string): Promise<ConnectorInstanceRow | undefined> {
      return db.selectFrom("connector_instance").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },
    async getByName(workspaceId: string, name: string): Promise<ConnectorInstanceRow | undefined> {
      return db.selectFrom("connector_instance").selectAll().where("workspace_id", "=", workspaceId).where("name", "=", name).executeTakeFirst();
    },
    /** Decrypted config — server-side use only (execute/poll/health). */
    async getLive(workspaceId: string, id: string): Promise<{ row: ConnectorInstanceRow; config: Record<string, string> } | undefined> {
      const row = workspaceId
        ? await this.get(workspaceId, id)
        : await db.selectFrom("connector_instance").selectAll().where("id", "=", id).executeTakeFirst();
      if (!row) return undefined;
      const stored = parseJson<Record<string, string>>(row.config_json, {});
      const config: Record<string, string> = {};
      for (const [k, v] of Object.entries(stored)) {
        const field = getTemplate(row.template_id)?.fields.find((f) => f.key === k);
        config[k] = field?.secret ? decryptSecret(v, encryptionKey) : v;
      }
      return { row, config };
    },
    async create(input: { workspaceId: string; template: ConnectorTemplate; name: string; config: Record<string, string>; enabled: boolean; scopeAll: boolean; scopeIds: string[]; agentIds?: string[] }): Promise<ConnectorInstanceRow> {
      const row: ConnectorInstanceRow = {
        id: ulid(), workspace_id: input.workspaceId, template_id: input.template.id, name: input.name,
        config_json: encryptConfig(input.template, input.config), enabled: input.enabled ? 1 : 0,
        scope_mode: input.scopeAll ? "all" : "spaces", scope_all: input.scopeAll ? 1 : 0, scope_ids_json: JSON.stringify(input.scopeIds),
        agent_ids_json: JSON.stringify(input.agentIds ?? []),
        health_status: null, health_error: null, health_checked_at: null,
        created_at: now(), updated_at: now(),
      };
      await db.insertInto("connector_instance").values(row as any).execute();
      return row;
    },
    async updateConfig(workspaceId: string, id: string, template: ConnectorTemplate, config: Record<string, string>): Promise<ConnectorInstanceRow | undefined> {
      return db.updateTable("connector_instance").set({ config_json: encryptConfig(template, config), updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).returningAll().executeTakeFirst();
    },
    async update(workspaceId: string, id: string, patch: Partial<Pick<ConnectorInstanceRow, "name" | "enabled" | "scope_mode" | "scope_all" | "scope_ids_json" | "agent_ids_json" | "health_status" | "health_error" | "health_checked_at">>): Promise<ConnectorInstanceRow | undefined> {
      return db.updateTable("connector_instance").set({ ...patch, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).returningAll().executeTakeFirst();
    },
    async remove(workspaceId: string, id: string): Promise<void> {
      await db.deleteFrom("event_queue").where("workspace_id", "=", workspaceId).where("instance_id", "=", id).execute();
      await db.deleteFrom("broadcast").where("workspace_id", "=", workspaceId).where("instance_id", "=", id).execute();
      await db.deleteFrom("connector_state").where("workspace_id", "=", workspaceId).where("instance_id", "=", id).execute();
      await db.deleteFrom("connector_instance").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },
    async setHealth(workspaceId: string, id: string, status: "ok" | "error", error: string | null): Promise<void> {
      await db.updateTable("connector_instance").set({ health_status: status, health_error: error, health_checked_at: now(), updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },
  };

  // --- Connector state (poller bookkeeping) ---------------------------------
  const state = {
    async get(instanceId: string): Promise<ConnectorStateRow | undefined> {
      return db.selectFrom("connector_state").selectAll().where("instance_id", "=", instanceId).executeTakeFirst();
    },
    async set(workspaceId: string, instanceId: string, stateJson: string): Promise<void> {
      await db.insertInto("connector_state")
        .values({ instance_id: instanceId, workspace_id: workspaceId, state_json: stateJson, updated_at: now() } as any)
        .onConflict((oc) => oc.column("instance_id").doUpdateSet({ state_json: stateJson, updated_at: now() }))
        .execute();
    },
    async remove(workspaceId: string, instanceId: string): Promise<void> {
      await db.deleteFrom("connector_state").where("workspace_id", "=", workspaceId).where("instance_id", "=", instanceId).execute();
    },
  };

  // --- Broadcasts + queues --------------------------------------------------
  const queues = {
    async list(workspaceId: string, instanceId?: string): Promise<Array<EventQueueRow & { pending: number }>> {
      const rows = instanceId
        ? await db.selectFrom("event_queue").selectAll().where("workspace_id", "=", workspaceId).where("instance_id", "=", instanceId).execute()
        : await db.selectFrom("event_queue").selectAll().where("workspace_id", "=", workspaceId).execute();
      const withCounts = await Promise.all(rows.map(async (q) => ({ ...q, pending: await this.pendingCount(q.id) })));
      return withCounts;
    },
    async get(workspaceId: string, instanceId: string, name: string): Promise<EventQueueRow | undefined> {
      return db.selectFrom("event_queue").selectAll().where("workspace_id", "=", workspaceId).where("instance_id", "=", instanceId).where("name", "=", name).executeTakeFirst();
    },
    async create(workspaceId: string, instanceId: string, name: string, createdBy: string | null): Promise<EventQueueRow> {
      const existing = await this.get(workspaceId, instanceId, name);
      if (existing) return existing;
      const row: EventQueueRow = { id: ulid(), workspace_id: workspaceId, instance_id: instanceId, name, created_by: createdBy, created_at: now() };
      await db.insertInto("event_queue").values(row as any).execute();
      return row;
    },
    async remove(workspaceId: string, instanceId: string, name: string): Promise<void> {
      const q = await this.get(workspaceId, instanceId, name);
      if (!q) return;
      await db.deleteFrom("event_queue_item").where("queue_id", "=", q.id).execute();
      await db.deleteFrom("event_queue").where("id", "=", q.id).execute();
    },
    async pendingCount(queueId: string): Promise<number> {
      const r = await db.selectFrom("event_queue_item").select((eb) => eb.fn.countAll<number>().as("n")).where("queue_id", "=", queueId).where("status", "=", "pending").executeTakeFirst();
      return Number(r?.n ?? 0);
    },
    /** Atomically claim the oldest pending item (marks delivered). */
    async next(queueId: string): Promise<EventQueueItemRow | undefined> {
      const item = await db.selectFrom("event_queue_item").selectAll().where("queue_id", "=", queueId).where("status", "=", "pending").orderBy("created_at").limit(1).executeTakeFirst();
      if (!item) return undefined;
      const claimed = await db.updateTable("event_queue_item").set({ status: "delivered", delivered_at: now() }).where("id", "=", item.id).where("status", "=", "pending").returningAll().executeTakeFirst();
      return claimed ?? undefined;
    },
    async peek(queueId: string, limit: number): Promise<EventQueueItemRow[]> {
      return db.selectFrom("event_queue_item").selectAll().where("queue_id", "=", queueId).orderBy("created_at").limit(limit).execute();
    },
    async insert(queueId: string, workspaceId: string, event: string, payload: unknown): Promise<void> {
      await db.insertInto("event_queue_item").values({ id: ulid(), queue_id: queueId, workspace_id: workspaceId, event, payload_json: JSON.stringify(payload ?? null), status: "pending", created_at: now(), delivered_at: null } as any).execute();
    },
    async recentItems(workspaceId: string, queueId: string, limit: number): Promise<EventQueueItemRow[]> {
      return db.selectFrom("event_queue_item").selectAll().where("workspace_id", "=", workspaceId).where("queue_id", "=", queueId).orderBy(sql`created_at desc`).limit(limit).execute();
    },
  };

  const broadcasts = {
    async insert(workspaceId: string, instanceId: string, event: string, payload: unknown): Promise<BroadcastRow> {
      const row: BroadcastRow = { id: ulid(), workspace_id: workspaceId, instance_id: instanceId, event, payload_json: JSON.stringify(payload ?? null), created_at: now() };
      await db.insertInto("broadcast").values(row as any).execute();
      return row;
    },
    async list(workspaceId: string, opts: { instanceId?: string; event?: string; since?: string; limit?: number }): Promise<BroadcastRow[]> {
      let q = db.selectFrom("broadcast").selectAll().where("workspace_id", "=", workspaceId).$call((qb) => (opts.instanceId ? qb.where("instance_id", "=", opts.instanceId) : qb));
      q = q.$call((qb) => (opts.event ? qb.where("event", "=", opts.event) : qb));
      q = q.$call((qb) => (opts.since ? qb.where("created_at", ">", opts.since) : qb));
      return q.orderBy(sql`created_at desc`).limit(Math.min(opts.limit ?? 50, 500)).execute();
    },
    /** Row created_at values come back as Date objects from pg — normalize. */
    norm(row: BroadcastRow): BroadcastRow & { payload: unknown } {
      return { ...row, created_at: new Date(row.created_at).toISOString(), payload: parseJson(row.payload_json, null) };
    },
  };

  return { mcp, instances, state, queues, broadcasts };
}

// getTemplate is injected from the registry (kept at the bottom to avoid a
// repo→registry import cycle at module-eval time; it's only called inside
// methods).
import { getTemplate } from "../connectors/registry.js";

export type ToolkitRepo = ReturnType<typeof createToolkitRepo>;
