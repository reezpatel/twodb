import {
  createAuthEngine,
  createWorkspacePlatform,
  resolveAuthContext,
  migrateAuthEngine,
  type AuthEngineOptions,
} from "@twodb/core-platform/auth";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import type { TwoDbConfig } from "../config.js";

function buildEngineOptions(db: Kysely<ControlPlaneDb>, config: TwoDbConfig): AuthEngineOptions {
  return {
    db: db as any,
    dbType: "sqlite",
    secret: config.AUTH_SECRET,
    baseURL: config.AUTH_BASE_URL,
    trustedOrigins: config.AUTH_TRUSTED_ORIGINS,
    passkey: { rpName: "TwoDB", rpID: config.PASSKEY_RP_ID, origin: config.PASSKEY_ORIGIN },
    google:
      config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
        ? { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET }
        : undefined,
    pocketId:
      config.POCKETID_ISSUER && config.POCKETID_CLIENT_ID && config.POCKETID_CLIENT_SECRET
        ? {
            issuer: config.POCKETID_ISSUER,
            clientId: config.POCKETID_CLIENT_ID,
            clientSecret: config.POCKETID_CLIENT_SECRET,
          }
        : undefined,
  };
}

/** Creates/updates better-auth's own tables. Call once on boot, before `setupAuth`. */
export async function bootstrapAuthTables(db: Kysely<ControlPlaneDb>, config: TwoDbConfig): Promise<void> {
  await migrateAuthEngine(buildEngineOptions(db, config));
}

export function setupAuth(db: Kysely<ControlPlaneDb>, config: TwoDbConfig) {
  const authEngine = createAuthEngine(buildEngineOptions(db, config));

  const workspacePlatform = createWorkspacePlatform(db as any);

  async function resolveContext(headers: Headers, requestedWorkspaceId?: string | null, requestedSpaceIds?: string | null) {
    return resolveAuthContext({
      authEngine,
      workspacePlatform,
      headers,
      requestedWorkspaceId,
      requestedSpaceIds,
    });
  }

  return { authEngine, workspacePlatform, resolveContext };
}

export type AuthSetup = ReturnType<typeof setupAuth>;
