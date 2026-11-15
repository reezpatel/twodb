import type { Kysely } from "@twodb/core-data/db";
import type { ToolkitDb, ConnectorInstanceRow } from "./db/schema.js";
import type { ToolkitRepo } from "./db/repository.js";
import { getTemplate } from "./connectors/registry.js";
import type { ConnectorRuntime } from "./connectors/types.js";

/**
 * Connector poller engine: a 15s tick runs poll() for every enabled instance
 * whose template interval has elapsed. Emits fan out through publishBroadcast
 * (pg_notify broadcast + durable queue inserts + broadcast log).
 */
export interface BroadcastPublisher {
  (workspaceId: string, instanceId: string, event: string, payload: unknown): Promise<void>;
}

export function startPoller(opts: { db: Kysely<ToolkitDb>; repo: ToolkitRepo; publish: BroadcastPublisher; log: (msg: string, data?: unknown) => void }): { stop(): void } {
  const { db, repo, publish, log } = opts;
  const lastRun = new Map<string, number>();
  const inFlight = new Set<string>();
  let stopped = false;

  const makeRuntime = (row: ConnectorInstanceRow, config: Record<string, string>): ConnectorRuntime => ({
    config,
    async getState() {
      const s = await repo.state.get(row.id);
      if (!s) return null;
      try { return JSON.parse(s.state_json); } catch { return null; }
    },
    async setState(state) {
      await repo.state.set(row.workspace_id, row.id, JSON.stringify(state));
    },
    async emit(event, payload) {
      await publish(row.workspace_id, row.id, event, payload);
    },
    log: (message) => log(`connector ${row.name}`, message),
  });

  const getLiveByInstance = async (instanceId: string) => {
    const row = await db.selectFrom("connector_instance").selectAll().where("id", "=", instanceId).executeTakeFirst();
    if (!row) return undefined;
    return await repo.instances.getLive(row.workspace_id, instanceId);
  };

  const runOne = async (instanceId: string) => {
    const live = await getLiveByInstance(instanceId);
    if (!live) return;
    const template = getTemplate(live.row.template_id);
    if (!template?.poll) return;
    const rt = makeRuntime(live.row, live.config);
    try {
      await template.poll(rt);
      if (live.row.health_status !== "ok") await repo.instances.setHealth(live.row.workspace_id, instanceId, "ok", null);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      log(`poller: instance ${instanceId} failed`, message);
      await repo.instances.setHealth(live.row.workspace_id, instanceId, "error", message);
    }
  };

  const tick = async () => {
    if (stopped) return;
    let rows: ConnectorInstanceRow[] = [];
    try {
      rows = await db.selectFrom("connector_instance").selectAll().where("enabled", "=", 1).execute();
    } catch (err) {
      log("poller: listing instances failed", (err as Error).message);
      return;
    }
    const now = Date.now();
    for (const row of rows) {
      const template = getTemplate(row.template_id);
      if (!template?.poll || !template.pollIntervalMs) continue;
      if (now - (lastRun.get(row.id) ?? 0) < template.pollIntervalMs) continue;
      if (inFlight.has(row.id)) continue;
      lastRun.set(row.id, now);
      inFlight.add(row.id);
      void runOne(row.id).finally(() => inFlight.delete(row.id));
    }
  };

  const timer = setInterval(() => void tick(), 15_000);
  setTimeout(() => void tick(), 5_000); // first tick shortly after boot
  log("poller: started");

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
