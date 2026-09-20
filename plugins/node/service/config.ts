import type { Kysely } from "kysely";
import type { TwodbContext } from "@twodb/shared-backend";

export type NodePluginConfig = {
  offline_wait_ms: number;
};

type RegistryDb = {
  admin_plugins: {
    identifier: string;
    config: NodePluginConfig | null;
  };
};

export const DEFAULT_OFFLINE_WAIT_MS = 300_000;

export const defaultNodeConfig: NodePluginConfig = {
  offline_wait_ms: DEFAULT_OFFLINE_WAIT_MS,
};

export async function readNodeConfig(ctx: TwodbContext): Promise<NodePluginConfig> {
  if (!ctx.pluginId) return defaultNodeConfig;

  const db = ctx.db as unknown as Kysely<RegistryDb>;
  const row = await db.selectFrom("admin_plugins").select("config").where("identifier", "=", ctx.pluginId).executeTakeFirst();

  const stored = row?.config;
  const wait = typeof stored?.offline_wait_ms === "number" ? stored.offline_wait_ms : DEFAULT_OFFLINE_WAIT_MS;
  return {
    offline_wait_ms: Math.min(Math.max(Math.round(wait), 0), 3_600_000),
  };
}
