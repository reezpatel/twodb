import type { Kysely } from "kysely";
import { createHash } from "node:crypto";
import type { ControlPlaneDb, RegisteredAppRow, InstallStatus } from "./sqlite.js";

export interface CreateInstallInput {
  slug: string;
  name: string;
  version: string;
  shape: string;
  basePath: string;
  hostId: string;
  capabilities: string[];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRegistryRepo(db: Kysely<ControlPlaneDb>) {
  return {
    /**
     * Creates (or resets) a row for an app TwoDB is about to install, with a
     * unique per-app registration token. Returns the plaintext token exactly
     * once — it's never persisted, only its hash — to be injected into the
     * container's env as `TWODB_REGISTRATION_TOKEN`.
     */
    async beginInstall(input: CreateInstallInput, registrationToken: string): Promise<void> {
      const existing = await db
        .selectFrom("registered_app")
        .select("slug")
        .where("slug", "=", input.slug)
        .executeTakeFirst();

      const base = {
        name: input.name,
        version: input.version,
        shape: input.shape,
        base_path: input.basePath,
        host_id: input.hostId,
        capabilities: JSON.stringify(input.capabilities),
        registration_token_hash: hashToken(registrationToken),
        install_status: "installing" as InstallStatus,
        installed_at: new Date().toISOString(),
        status: "unknown",
      };

      if (existing) {
        await db.updateTable("registered_app").set(base).where("slug", "=", input.slug).execute();
      } else {
        await db
          .insertInto("registered_app")
          .values({
            ...base,
            slug: input.slug,
            http_url: "",
            socket_path: null,
            manifest_json: "",
            pg_schema: null,
            pg_role: null,
            pg_connection_string_encrypted: null,
            image_tag: null,
            container_name: null,
            host_port: null,
            registered_at: null,
            last_seen_at: null,
          })
          .execute();
      }
    },

    async setProvisioning(slug: string, pgSchema: string, pgRole: string, encryptedConnectionString: string) {
      await db
        .updateTable("registered_app")
        .set({
          pg_schema: pgSchema,
          pg_role: pgRole,
          pg_connection_string_encrypted: encryptedConnectionString,
        })
        .where("slug", "=", slug)
        .execute();
    },

    async setContainerInfo(slug: string, info: { imageTag: string; containerName: string; hostPort: number }) {
      await db
        .updateTable("registered_app")
        .set({ image_tag: info.imageTag, container_name: info.containerName, host_port: info.hostPort })
        .where("slug", "=", slug)
        .execute();
    },

    async setInstallStatus(slug: string, status: InstallStatus) {
      await db.updateTable("registered_app").set({ install_status: status }).where("slug", "=", slug).execute();
    },

    /**
     * Called from `POST /registry/register` once the newly-started
     * container boots and calls home. Verifies the token the app presents
     * hashes to what TwoDB generated at install time for that exact slug —
     * replacing the old shared-secret guard with a per-app, revocable one.
     */
    async completeRegistration(input: {
      slug: string;
      registrationToken: string;
      httpUrl: string;
      socketPath?: string;
      manifestJson: unknown;
    }): Promise<{ ok: true } | { ok: false; reason: string }> {
      const row = await db
        .selectFrom("registered_app")
        .selectAll()
        .where("slug", "=", input.slug)
        .executeTakeFirst();

      if (!row) return { ok: false, reason: `"${input.slug}" was never installed` };
      if (!row.registration_token_hash) return { ok: false, reason: "app has no registration token on file" };
      if (hashToken(input.registrationToken) !== row.registration_token_hash) {
        return { ok: false, reason: "invalid registration token" };
      }

      await db
        .updateTable("registered_app")
        .set({
          http_url: input.httpUrl,
          socket_path: input.socketPath ?? null,
          manifest_json: JSON.stringify(input.manifestJson),
          install_status: "running",
          status: "active",
          registered_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .where("slug", "=", input.slug)
        .execute();

      return { ok: true };
    },

    async listApps(): Promise<RegisteredAppRow[]> {
      return db.selectFrom("registered_app").selectAll().execute();
    },

    /**
     * TwoDB is the one app that doesn't go through the install/Docker
     * lifecycle — it *is* the thing installing everyone else — so it writes
     * its own registry row directly instead of presenting a registration
     * token to itself over HTTP. Purely so `twodb apps` / the admin UI can
     * list TwoDB's own endpoints the same way as any other app.
     */
    async registerSelf(input: {
      slug: string;
      name: string;
      version: string;
      shape: string;
      basePath: string;
      httpUrl: string;
      hostId: string;
      capabilities: string[];
      manifestJson: unknown;
    }): Promise<void> {
      const existing = await db
        .selectFrom("registered_app")
        .select("slug")
        .where("slug", "=", input.slug)
        .executeTakeFirst();

      const row = {
        name: input.name,
        version: input.version,
        shape: input.shape,
        base_path: input.basePath,
        http_url: input.httpUrl,
        host_id: input.hostId,
        capabilities: JSON.stringify(input.capabilities),
        manifest_json: JSON.stringify(input.manifestJson),
        install_status: "running" as InstallStatus,
        status: "active",
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      if (existing) {
        await db.updateTable("registered_app").set(row).where("slug", "=", input.slug).execute();
      } else {
        await db
          .insertInto("registered_app")
          .values({
            ...row,
            slug: input.slug,
            socket_path: null,
            pg_schema: null,
            pg_role: null,
            pg_connection_string_encrypted: null,
            registration_token_hash: null,
            image_tag: null,
            container_name: null,
            host_port: null,
            installed_at: new Date().toISOString(),
          })
          .execute();
      }
    },

    async getApp(slug: string): Promise<RegisteredAppRow | undefined> {
      return db.selectFrom("registered_app").selectAll().where("slug", "=", slug).executeTakeFirst();
    },

    async listAppsWithCapability(capability: string): Promise<RegisteredAppRow[]> {
      const apps = await db.selectFrom("registered_app").selectAll().execute();
      return apps.filter(
        (a) => a.manifest_json && (JSON.parse(a.capabilities) as string[]).includes(capability),
      );
    },

    async touchLastSeen(slug: string) {
      await db
        .updateTable("registered_app")
        .set({ last_seen_at: new Date().toISOString() })
        .where("slug", "=", slug)
        .execute();
    },

    async remove(slug: string) {
      await db.deleteFrom("registered_app").where("slug", "=", slug).execute();
    },
  };
}

export type RegistryRepo = ReturnType<typeof createRegistryRepo>;
