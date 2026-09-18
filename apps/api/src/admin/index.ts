import { Migrator } from "kysely/migration";
import { migrations } from "./migrations";
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
  });

  await migrator.migrateToLatest();

  const loadedPlugins = await registerServicePlugins(app);

  app.get("/api/v1/plugins", async () => {
    return loadedPlugins.map((p) => ({
      ...p.manifest,
      hasStyles: fs.existsSync(path.join(p.dir, "view", "styles.css")),
    }));
  });

  await app.register(authRoutes);
  await app.register(passkeyRoutes);
  await app.register(instanceRoutes);
  await app.register(pluginRoutes);
};
