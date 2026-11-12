import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import type { Kysely } from "@twodb/core-data/db";
import {
  INTERNAL_MANIFEST_PATH,
  REGISTRATION_TOKEN_HEADER,
  handleManifestRequest,
} from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";
import type { TwoDriveConfig } from "./config.js";
import { applySchema, type TwoDriveDb } from "./db/schema.js";
import { registerBackendRoutes, registerStorageRoutes } from "./routes/backends.js";
import { registerExplorerRoutes } from "./routes/explorer.js";
import { registerAppApiRoutes, registerAppOverrideRoutes } from "./routes/app-api.js";
import { registerS3Routes, registerAccessKeyRoutes, registerShareRoutes } from "./routes/s3.js";

export async function buildServer(config: TwoDriveConfig) {
  const app = Fastify({ logger: true });
  // Raw bodies preserved byte-for-byte (file uploads + S3 PUTs may be any
  // content type) — same parser setup as the Gateway/TwoRoute.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  const db = createPgDb<TwoDriveDb>({ connectionString: config.DATABASE_URL, schema: "twodrive" });
  await applySchema(db);

  const dataKey = config.TWODB_DATA_KEY ?? config.TWODB_PROVISION_TOKEN;

  // The workspace's default virtual storage for app folders is stored as a
  // row in drive_app_override under the reserved app_id "__default__" —
  // keyed per workspace, like every other override.
  const DEFAULT_SENTINEL = "__default__";
  const getDefaultVsId = async (workspaceId?: string): Promise<string | null> => {
    const row = await db
      .selectFrom("drive_app_override")
      .select("virtual_storage_id")
      .where("app_id", "=", DEFAULT_SENTINEL)
      .where("workspace_id", "=", workspaceId ?? "")
      .executeTakeFirst();
    return row?.virtual_storage_id ?? null;
  };
  const setDefaultVsId = async (id: string | null, workspaceId?: string): Promise<void> => {
    const existing = await db
      .selectFrom("drive_app_override")
      .select("id")
      .where("app_id", "=", DEFAULT_SENTINEL)
      .where("workspace_id", "=", workspaceId ?? "")
      .executeTakeFirst();
    if (id) {
      if (existing) {
        await db
          .updateTable("drive_app_override")
          .set({ virtual_storage_id: id, updated_at: new Date().toISOString() })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("drive_app_override")
          .values({
            id: crypto.randomUUID(),
            workspace_id: workspaceId ?? "__unset__",
            app_id: DEFAULT_SENTINEL,
            virtual_storage_id: id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never)
          .execute();
      }
    } else if (existing) {
      await db.deleteFrom("drive_app_override").where("id", "=", existing.id).execute();
    }
  };

  const ctx = { db, config, dataKey, getDefaultVsId, setDefaultVsId };

  // Pull-registration endpoint (docker-install flow).
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      manifest,
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      req.headers[REGISTRATION_TOKEN_HEADER],
    );
    return reply.code(res.status).send(res.body);
  });

  app.get("/healthz", async () => ({ ok: true, app: manifest.slug }));

  registerBackendRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerExplorerRoutes(app, ctx);
  registerAppApiRoutes(app, ctx);
  registerAppOverrideRoutes(app, ctx);
  registerS3Routes(app, ctx);
  registerAccessKeyRoutes(app, ctx);
  registerShareRoutes(app, ctx);

  return { app, db };
}
