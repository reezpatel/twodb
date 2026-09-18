import type { FastifyInstance } from "fastify/types/instance";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { ServicePlugin } from "@twodb/shared-backend";
import { Migrator } from "kysely/migration";
import fastifyStatic from "@fastify/static";

export type LoadedPlugin = {
  dir: string;
  manifest: {
    name: string;
    version: string;

    twodb: {
      identifier: string;
      logo: string;
      provides: string[];
      requires: string[];
      tags: string[];
    };
  };
};

async function mountPlugin(app: FastifyInstance, bundle: LoadedPlugin): Promise<ServicePlugin> {
  const { manifest, dir } = bundle;
  const serviceFile = path.join(dir, "service", "main.js");

  const mod = (await import(pathToFileURL(serviceFile).href)) as {
    default: ServicePlugin;
  };
  const service = mod.default;

  const migrator = new Migrator({
    db: app.db,
    provider: {
      getMigrations: async () => service.migrations ?? {},
    },
    migrationTableName: `migration_${manifest.twodb.identifier}`,
  });

  await migrator.migrateToLatest();

  return service;
}

const resolvePluginDir = async (app: FastifyInstance, identifier: string, extractedPath = ""): Promise<string | null> => {
  const p = identifier.startsWith("local:") ? identifier.slice("local:".length) : extractedPath;

  if (p) {
    return path.isAbsolute(p) ? p : path.resolve(app.config.TWO_DB_WORK_DIR, p);
  }

  // TODO: Fetch
  app.log.warn(`plugin "${identifier}" needs the git:/npm: fetch pipeline, which is not implemented yet — skipping`);

  return null;
};

export async function registerServicePlugins(app: FastifyInstance): Promise<LoadedPlugin[]> {
  const entries = await app.db.selectFrom("admin_plugins").select(["identifier", "extracted_path"]).orderBy("created_at").execute();

  if (entries.length === 0) {
    app.log.info("plugin registry is empty — no service plugins to load");
  }

  const loaded: LoadedPlugin[] = [];

  for (const { identifier, extracted_path: extractedPath } of entries) {
    const dir = await resolvePluginDir(app, identifier, extractedPath || "");

    if (!dir) continue;

    let bundle: LoadedPlugin;

    try {
      const text = fs.readFileSync(path.join(dir, "package.json"), "utf-8");

      const data = JSON.parse(text)?.twodb ?? {};

      bundle = {
        dir,
        manifest: data,
      };
    } catch (err) {
      app.log.warn(`plugin "${identifier}" at ${dir} has an invalid manifest — skipping: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    await mountPlugin(app, bundle);
    loaded.push(bundle);

    app.log.info(`loaded service plugin ${bundle.manifest.name}@${bundle.manifest.version} from ${dir}`);

    await app.db
      .updateTable("admin_plugins")
      .set({ ...bundle.manifest, updated_at: new Date() })
      .where("identifier", "=", identifier)
      .execute();

    if (fs.existsSync(path.join(dir, "view", "main.js"))) {
      console.log(`registering view plugin for ${bundle.manifest.name} on prefix /api/v1/plugins/${bundle.manifest.twodb.identifier}/view/`);

      await app.register(fastifyStatic, {
        root: path.join(dir, "view"),
        prefix: `/api/v1/plugins/${bundle.manifest.twodb.identifier}/view/`,
        decorateReply: false,
      });
    }
  }

  return loaded;
}
