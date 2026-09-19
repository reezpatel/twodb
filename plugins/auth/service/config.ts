import type { Kysely } from "kysely";
import type { TwodbContext } from "@twodb/shared-backend";
import type { AuthPluginConfig } from "../shared/api";

type RegistryDb = {
  admin_plugins: {
    identifier: string;
    config: AuthPluginConfig | null;
  };
};

export const defaultAuthConfig: AuthPluginConfig = {
  passkeys: { enabled: true },
  googleSso: { enabled: false, clientId: "", clientSecret: "" },
  magicLink: { enabled: false },
};

export async function readAuthConfig(ctx: TwodbContext): Promise<AuthPluginConfig> {
  if (!ctx.pluginId) return defaultAuthConfig;

  const db = ctx.db as unknown as Kysely<RegistryDb>;
  const row = await db.selectFrom("admin_plugins").select("config").where("identifier", "=", ctx.pluginId).executeTakeFirst();

  const stored = row?.config;
  if (!stored) return defaultAuthConfig;

  return {
    passkeys: { enabled: stored.passkeys?.enabled ?? true },
    googleSso: {
      enabled: stored.googleSso?.enabled ?? false,
      clientId: stored.googleSso?.clientId ?? "",
      clientSecret: stored.googleSso?.clientSecret ?? "",
    },
    magicLink: { enabled: stored.magicLink?.enabled ?? false },
  };
}
