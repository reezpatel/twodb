import { Migrator } from "kysely/migration";
import { migrations } from "./migrations";
import { seedBakedPlugins } from "./seed";
import { registerServicePlugins } from "./plugin";
import fs from "node:fs";
import path from "node:path";
import authRoutes from "./routes/auth";
import passkeyRoutes from "./routes/passkeys";
import instanceRoutes from "./routes/instance";
import pluginRoutes from "./routes/plugins";
import type { FastifyInstance } from "fastify";

export const adminPlugin = async (app: FastifyInstance) => {
  const migrator = new Migrator({
    db: app.db,
    provider: {
      getMigrations: async () => {
        return migrations;
      },
    },
    allowUnorderedMigrations: true,
    migrationTableName: "migration_admin",
    migrationLockTableName: "migration_admin_lock",
  });

  // migrateToLatest returns errors instead of throwing
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;

  await seedBakedPlugins(app);

  const loadedPlugins = await registerServicePlugins(app);

  app.get("/api/v1/plugins", async () => {
    return loadedPlugins.map((p) => ({
      id: p.manifest.twodb.identifier,
      name: p.manifest.name,
      version: p.manifest.version,
      manifest: p.manifest.twodb,
      hasStyles: fs.existsSync(path.join(p.dir, "view", "styles.css")),
    }));
  });

  await app.register(authRoutes, { prefix: "/api/v1/admin" });
  await app.register(passkeyRoutes, { prefix: "/api/v1/admin" });
  await app.register(instanceRoutes, { prefix: "/api/v1/admin" });
  await app.register(pluginRoutes, { prefix: "/api/v1/admin" });
};
