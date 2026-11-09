import type { Kysely } from "kysely";
import type { ControlPlaneDb, RegisteredAppRow } from "./sqlite.js";

export interface RegisterAppInput {
  slug: string;
  name: string;
  version: string;
  shape: string;
  basePath: string;
  httpUrl: string;
  socketPath?: string;
  hostId: string;
  capabilities: string[];
  manifestJson: unknown;
}

export function createRegistryRepo(db: Kysely<ControlPlaneDb>) {
  return {
    /** Apps call this (through TwoDB's own `/registry/register` endpoint) on boot to self-register. */
    async registerApp(input: RegisterAppInput): Promise<void> {
      const existing = await db
        .selectFrom("registered_app")
        .select("slug")
        .where("slug", "=", input.slug)
        .executeTakeFirst();

      const row = {
        slug: input.slug,
        name: input.name,
        version: input.version,
        shape: input.shape,
        base_path: input.basePath,
        http_url: input.httpUrl,
        socket_path: input.socketPath ?? null,
        host_id: input.hostId,
        capabilities: JSON.stringify(input.capabilities),
        manifest_json: JSON.stringify(input.manifestJson),
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        status: "active",
      };

      if (existing) {
        await db.updateTable("registered_app").set(row).where("slug", "=", input.slug).execute();
      } else {
        await db
          .insertInto("registered_app")
          .values({ ...row, pg_schema: null, pg_role: null, pg_password_encrypted: null })
          .execute();
      }
    },

    async listApps(): Promise<RegisteredAppRow[]> {
      return db.selectFrom("registered_app").selectAll().execute();
    },

    async getApp(slug: string): Promise<RegisteredAppRow | undefined> {
      return db.selectFrom("registered_app").selectAll().where("slug", "=", slug).executeTakeFirst();
    },

    async listAppsWithCapability(capability: string): Promise<RegisteredAppRow[]> {
      const apps = await db.selectFrom("registered_app").selectAll().execute();
      return apps.filter((a) => (JSON.parse(a.capabilities) as string[]).includes(capability));
    },

    async setProvisioning(slug: string, pgSchema: string, pgRole: string, encryptedPassword: string) {
      await db
        .updateTable("registered_app")
        .set({ pg_schema: pgSchema, pg_role: pgRole, pg_password_encrypted: encryptedPassword })
        .where("slug", "=", slug)
        .execute();
    },

    async touchLastSeen(slug: string) {
      await db
        .updateTable("registered_app")
        .set({ last_seen_at: new Date().toISOString() })
        .where("slug", "=", slug)
        .execute();
    },
  };
}

export type RegistryRepo = ReturnType<typeof createRegistryRepo>;
