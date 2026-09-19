import type { FastifyInstance } from "fastify/types/instance";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { ServicePlugin } from "@twodb/shared-backend";
import { Migrator } from "kysely/migration";
import { sql } from "kysely";
import fastifyStatic from "@fastify/static";
import { normalizeTableName } from "@twodb/shared-backend/utils.js";
import type { Kysely } from "kysely";
import { requireAdmin } from "./lib/session";

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
    migrationTableName: `migration_${normalizeTableName(manifest.twodb.identifier)}`,
    migrationLockTableName: `migration_${normalizeTableName(manifest.twodb.identifier)}_lock`,
  });

  const { error } = await migrator.migrateToLatest();
  if (error) throw error;

  const pluginId = manifest.twodb.identifier;
  const ctx = { db: app.db as unknown as Kysely<unknown>, fn: {}, pluginId };
  const adminBase = `/api/v1/${pluginId}/admin`;

  await app.register(
    async (scope) => {
      scope.addHook("preHandler", async (request, reply) => {
        const url = request.url.split("?")[0];
        if (url === adminBase || url.startsWith(`${adminBase}/`)) {
          await requireAdmin(request, reply);
        }
      });
      await service.init?.(ctx, scope);
    },
    { prefix: `/api/v1/${pluginId}` },
  );

  return service;
}

const resolvePluginDir = async (app: FastifyInstance, identifier: string, extractedPath = ""): Promise<string | null> => {
  const p = identifier.startsWith("local:") ? identifier.slice("local:".length) : extractedPath;

  if (p) {
    const workDir = app.config.TWODB_WORK_DIR;
    return path.isAbsolute(p) ? p : path.resolve(workDir, p);
  }

  // TODO: Fetch
  app.log.warn(`plugin "${identifier}" needs the git:/npm: fetch pipeline, which is not implemented yet — skipping`);

  return null;
};

export const getPluginBundle = async (app: FastifyInstance, identifier: string, extractedPath = ""): Promise<LoadedPlugin | null> => {
  try {
    const dir = await resolvePluginDir(app, identifier, extractedPath);

    if (!dir) {
      return null;
    }

    const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
    const twodb = pkgJson?.twodb ?? {};
    if (typeof twodb.identifier !== "string" || !twodb.identifier) {
      app.log.warn(`plugin "${identifier}" at ${dir} has no twodb.identifier — skipping`);
      return null;
    }

    return {
      dir,
      manifest: { name: pkgJson?.name ?? "", version: pkgJson?.version ?? "", twodb },
    };
  } catch (err) {
    app.log.warn(`plugin "${identifier}" has an invalid manifest — skipping: ${err instanceof Error ? err.message : err}`);
    return null;
  }
};

export async function registerServicePlugins(app: FastifyInstance): Promise<LoadedPlugin[]> {
  const entries = await app.db.selectFrom("admin_plugins").select(["identifier", "extracted_path"]).orderBy("created_at").execute();

  if (entries.length === 0) {
    app.log.info("plugin registry is empty — no service plugins to load");
  }

  const loaded: LoadedPlugin[] = [];

  for (const { identifier, extracted_path: extractedPath } of entries) {
    const bundle = await getPluginBundle(app, identifier, extractedPath || "");

    if (!bundle) continue;

    await mountPlugin(app, bundle);
    loaded.push(bundle);

    app.log.info(`loaded service plugin ${bundle.manifest.name}@${bundle.manifest.version} from ${bundle.dir}`);

    await app.db
      .updateTable("admin_plugins")
      .set({
        name: bundle.manifest.name,
        version: bundle.manifest.version,
        provides: sql`${JSON.stringify(bundle.manifest.twodb.provides ?? [])}::jsonb`,
        manifest: bundle.manifest.twodb,
        updated_at: new Date(),
      })
      .where("identifier", "=", identifier)
      .execute();

    if (fs.existsSync(path.join(bundle.dir, "view", "main.js"))) {
      console.log(`registering view plugin for ${bundle.manifest.name} on prefix /api/v1/plugins/${bundle.manifest.twodb.identifier}/view/`);

      await app.register(fastifyStatic, {
        root: path.join(bundle.dir, "view"),
        prefix: `/api/v1/plugins/${bundle.manifest.twodb.identifier}/view/`,
        decorateReply: false,
      });
    }
  }

  return loaded;
}
