import type { Kysely } from "kysely";
import { createHash } from "node:crypto";
import { ulid } from "ulid";
import type { ControlPlaneDb, RegisteredAppRow, InstallStatus, AppTokenRow } from "./sqlite.js";
import { getCatalogEntry } from "../orchestrator/catalog.js";

export interface CreateInstallInput {
  slug: string;
  name: string;
  version: string;
  shape: string;
  basePath: string;
  hostId: string;
  capabilities: string[];
}

export interface RegisterExternalInput {
  slug: string;
  name: string;
  /** Where the app actually serves (e.g. http://192.168.2.9:7001). */
  httpUrl: string;
  /** Optional path prefix the gateway should strip when proxying. */
  basePath?: string;
  capabilities?: string[];
  /** App self-reported manifest (endpoint.json), if it serves one at GET /internal/manifest. */
  manifestJson?: unknown;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRegistryRepo(db: Kysely<ControlPlaneDb>) {
  return {
    /**
     * Creates (or resets) a row for an app TwoDB is about to install. Tokens
     * are separate (see issueToken) — the orchestrator mints a non-expiring
     * "managed" token and injects it into the container's env.
     */
    async beginInstall(input: CreateInstallInput): Promise<void> {
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
            managed: 1,
            http_url: "",
            socket_path: null,
            manifest_json: "",
            pg_schema: null,
            pg_role: null,
            pg_connection_string_encrypted: null,
            data_key_encrypted: null,
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

    async setDataKey(slug: string, encryptedDataKey: string) {
      await db
        .updateTable("registered_app")
        .set({ data_key_encrypted: encryptedDataKey })
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

    /** Records the version of the image actually installed (workspace package.json version for local builds, tag version for registry pulls). */
    async setVersion(slug: string, version: string) {
      await db.updateTable("registered_app").set({ version }).where("slug", "=", slug).execute();
    },

    async setInstallStatus(slug: string, status: InstallStatus) {
      await db.updateTable("registered_app").set({ install_status: status }).where("slug", "=", slug).execute();
    },

    // --- App tokens (gateway validates x-twodb-app + x-twodb-token) -------

    /** Mints a token for `slug`; plaintext is returned once, only the hash is stored. `ttlMs` null = never expires. */
    async issueToken(slug: string, kind: AppTokenRow["kind"], token: string, ttlMs: number | null) {
      const now = Date.now();
      const expiresAt = ttlMs === null ? null : new Date(now + ttlMs).toISOString();
      await db
        .insertInto("app_token")
        .values({
          id: ulid(),
          slug,
          token_hash: hashToken(token),
          kind,
          created_at: new Date(now).toISOString(),
          expires_at: expiresAt,
          revoked_at: null,
          last_used_at: null,
        })
        .execute();
      return { expiresAt };
    },

    /** Returns the token's kind iff it is live (unrevoked, unexpired) and was issued for exactly `slug`; otherwise null. */
    async verifyToken(slug: string, token: string): Promise<{ kind: AppTokenRow["kind"] } | null> {
      const row = await db
        .selectFrom("app_token")
        .selectAll()
        .where("token_hash", "=", hashToken(token))
        .executeTakeFirst();
      if (!row || row.slug !== slug || row.revoked_at) return null;
      if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) return null;
      // Best-effort usage stamp, throttled to once a minute to keep the hot path read-only.
      if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at) > 60_000) {
        void db
          .updateTable("app_token")
          .set({ last_used_at: new Date().toISOString() })
          .where("id", "=", row.id)
          .execute()
          .catch(() => {});
      }
      return { kind: row.kind };
    },

    async revokeTokens(slug: string, kind?: AppTokenRow["kind"]) {
      let q = db
        .updateTable("app_token")
        .set({ revoked_at: new Date().toISOString() })
        .where("slug", "=", slug)
        .where("revoked_at", "is", null);
      if (kind) q = q.where("kind", "=", kind);
      await q.execute();
    },

    /** Revokes every live token of `kind` for `slug` except the one whose plaintext is `keepToken`. */
    async revokeTokensExcept(slug: string, kind: AppTokenRow["kind"], keepToken: string) {
      await db
        .updateTable("app_token")
        .set({ revoked_at: new Date().toISOString() })
        .where("slug", "=", slug)
        .where("kind", "=", kind)
        .where("revoked_at", "is", null)
        .where("token_hash", "!=", hashToken(keepToken))
        .execute();
    },

    async revokeTokenById(id: string) {
      await db.updateTable("app_token").set({ revoked_at: new Date().toISOString() }).where("id", "=", id).execute();
    },

    /** Token metadata only — never the hash. */
    async listTokens(slug: string) {
      return db
        .selectFrom("app_token")
        .select(["id", "slug", "kind", "created_at", "expires_at", "revoked_at", "last_used_at"])
        .where("slug", "=", slug)
        .orderBy("created_at", "desc")
        .execute();
    },

    // --- App-initiated registration + liveness -----------------------------

    /**
     * Upserts the registry row for an app that has authenticated (by a live
     * token or the registration secret) and announces itself. Existing rows
     * (e.g. a managed install) keep their lifecycle fields; brand-new apps
     * become unmanaged entries. Marks the app active.
     */
    async registerApp(input: {
      slug: string;
      name?: string;
      version?: string;
      httpUrl: string;
      socketPath?: string;
      capabilities?: string[];
      manifestJson: unknown;
      hostId: string;
    }): Promise<{ created: boolean }> {
      const now = new Date().toISOString();
      const existing = await db.selectFrom("registered_app").select(["slug", "managed"]).where("slug", "=", input.slug).executeTakeFirst();
      const common = {
        http_url: input.httpUrl.replace(/\/+$/, ""),
        socket_path: input.socketPath ?? null,
        manifest_json: JSON.stringify(input.manifestJson ?? {}),
        status: "active",
        registered_at: now,
        last_seen_at: now,
      };
      if (existing) {
        await db
          .updateTable("registered_app")
          .set({
            ...common,
            // A self-reported name (manifest.name) wins over whatever the install seeded (the slug).
            ...(input.name ? { name: input.name } : {}),
            ...(input.version ? { version: input.version } : {}),
            ...(input.capabilities ? { capabilities: JSON.stringify(input.capabilities) } : {}),
            // A managed app that has come up is "running"; unmanaged stay "external".
            ...(existing.managed === 1 ? { install_status: "running" as InstallStatus } : {}),
          })
          .where("slug", "=", input.slug)
          .execute();
        return { created: false };
      }
      await db
        .insertInto("registered_app")
        .values({
          ...common,
          slug: input.slug,
          name: input.name ?? input.slug,
          version: input.version ?? "unknown",
          shape: "backend",
          base_path: `/apps/${input.slug}`,
          host_id: input.hostId,
          capabilities: JSON.stringify(input.capabilities ?? []),
          pg_schema: null,
          pg_role: null,
          pg_connection_string_encrypted: null,
          data_key_encrypted: null,
          registration_token_hash: null,
          image_tag: null,
          container_name: null,
          host_port: null,
          install_status: "external",
          managed: 0,
          installed_at: null,
        })
        .execute();
      return { created: true };
    },

    /** Heartbeat. Returns false if the slug is unknown. */
    async ping(slug: string): Promise<boolean> {
      const res = await db
        .updateTable("registered_app")
        .set({ last_seen_at: new Date().toISOString(), status: "active" })
        .where("slug", "=", slug)
        .executeTakeFirst();
      return Number(res.numUpdatedRows) > 0;
    },

    /** Marks apps that stopped pinging as inactive. TwoDB's own row and manually-added external entries are exempt. */
    async markStale(cutoffIso: string): Promise<number> {
      const res = await db
        .updateTable("registered_app")
        .set({ status: "inactive" })
        .where("status", "=", "active")
        .where("slug", "!=", "twodb")
        .where("last_seen_at", "<", cutoffIso)
        .executeTakeFirst();
      return Number(res.numUpdatedRows);
    },

    async listApps(): Promise<RegisteredAppRow[]> {
      return db.selectFrom("registered_app").selectAll().execute();
    },

    /**
     * Registers an EXTERNAL (unmanaged) app: an entry based on its URL that
     * the control plane routes through the gateway but whose lifecycle it
     * does NOT own — no container, no install/stop/upgrade, no provisioning.
     * The gateway proxies `/<basePath>` to `httpUrl`; health is whatever the
     * app reports on last_seen_at when it self-registers, or "external".
     */
    async registerExternal(input: RegisterExternalInput): Promise<{ ok: true } | { ok: false; reason: string }> {
      const slug = input.slug.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return { ok: false, reason: "slug must be kebab-case" };
      if (!/^https?:\/\//.test(input.httpUrl)) return { ok: false, reason: "httpUrl must be an http(s) URL" };
      if (getCatalogEntry && getCatalogEntry(slug) && slug !== "twodb") {
        // allow shadowing catalog apps only if they aren't currently managed-installed
        const existing = await db.selectFrom("registered_app").select(["slug", "managed", "install_status"]).where("slug", "=", slug).executeTakeFirst();
        if (existing?.managed && existing.install_status !== "not_installed" && existing.install_status !== "uninstalled") {
          return { ok: false, reason: `"${slug}" is a managed catalog app currently installed — remove it first` };
        }
      }

      const basePath = (input.basePath ?? `/${slug}`).replace(/\/+$/, "") || `/${slug}`;
      const now = new Date().toISOString();
      const row = {
        name: input.name.trim(),
        version: "external",
        shape: "external",
        base_path: basePath,
        http_url: input.httpUrl.replace(/\/+$/, ""),
        host_id: "external",
        capabilities: JSON.stringify(input.capabilities ?? []),
        manifest_json: input.manifestJson ? JSON.stringify(input.manifestJson) : "",
        install_status: "external" as InstallStatus,
        managed: 0,
        registered_at: now,
        last_seen_at: null,
        status: "external",
      };

      const existing = await db.selectFrom("registered_app").select("slug").where("slug", "=", slug).executeTakeFirst();
      if (existing) {
        await db.updateTable("registered_app").set(row).where("slug", "=", slug).execute();
      } else {
        await db
          .insertInto("registered_app")
          .values({
            ...row,
            slug,
            managed: 1,
            socket_path: null,
            pg_schema: null,
            pg_role: null,
            pg_connection_string_encrypted: null,
            data_key_encrypted: null,
            registration_token_hash: null,
            image_tag: null,
            container_name: null,
            host_port: null,
            installed_at: null,
          })
          .execute();
      }
      return { ok: true };
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
        managed: 1,
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
            data_key_encrypted: null,
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
      await db.deleteFrom("app_token").where("slug", "=", slug).execute();
      await db.deleteFrom("registered_app").where("slug", "=", slug).execute();
    },
  };
}

export type RegistryRepo = ReturnType<typeof createRegistryRepo>;
