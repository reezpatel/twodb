import {
  createAuthEngine,
  createWorkspacePlatform,
  resolveAuthContext,
  migrateAuthEngine,
  type AuthEngineOptions,
} from "@twodb/core-platform/auth";
import type { Kysely } from "kysely";
import { ulid } from "ulid";
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
    firstUserBootstrap: {
      // Bootstrap closes once a user WITH a passkey exists — orphan users
      // from cancelled ceremonies (no passkey bound) keep registration open.
      hasUsers: async () => {
        const row = await (db as any)
          .selectFrom("user")
          .innerJoin("passkey", "passkey.userId", "user.id")
          .select((eb: any) => eb.fn.countAll().as("n"))
          .executeTakeFirst();
        return Number(row?.n ?? 0) > 0;
      },
      createUser: async (name: string, email: string) => {
        // better-auth's user schema (id, name, email, emailVerified, image,
        // timestamps; admin plugin adds role). The passkey plugin never
        // creates this row itself, and the challenge binds to the id — so
        // first-run bootstrap creates it at options-generation time. First
        // user is a superadmin.
        const id = ulid();
        const now = new Date().toISOString();
        await (db as any)
          .insertInto("user")
          .values({
            id,
            name,
            email,
            emailVerified: 1, // better-auth stores booleans as 0/1 on sqlite
            image: null,
            role: "admin",
            createdAt: now,
            updatedAt: now,
          })
          .execute();

        // Zero-setup bootstrap: the first user gets a personal workspace
        // with a default space, so session auth (which requires workspace
        // membership) works immediately.
        const platform = createWorkspacePlatform(db as any);
        const org = await platform.createOrg(`${name}'s org`);
        const workspace = await platform.createWorkspace(org.id, "Personal");
        await platform.createSpace(workspace.id, "default");
        await platform.addWorkspaceMember(workspace.id, id, "owner");

        return id;
      },
    },
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

/**
 * Sweeps bootstrap orphans: user rows created by a sessionless
 * generate-register-options whose ceremony was never completed (no passkey
 * bound). Called on every boot — safe because the sweep only touches users
 * with zero passkeys, which outside bootstrap is impossible (every other
 * flow creates the passkey atomically with the user or requires a session).
 */
export async function sweepOrphanUsers(db: Kysely<ControlPlaneDb>): Promise<void> {
  await (db as any)
    .deleteFrom("user")
    .where(({ not, exists, selectFrom, lit }: any) =>
      not(exists(selectFrom("passkey").select(lit(1)).whereRef("passkey.userId", "=", "user.id"))),
    )
    .execute();
}

export type AuthSetup = ReturnType<typeof setupAuth>;
