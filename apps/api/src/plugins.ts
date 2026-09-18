import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, HTTPMethods } from "fastify";
import { pluginSchemaName, runPluginMigrations, scopedDb, type ServicePlugin } from "@twodb/shared-backend";

// Loads built plugin bundles into the api. A plugin bundle is a directory
// shaped like a published npm package:
//
//   package.json      name, version, `twodb` manifest (identifier, …)
//   service/main.js   node ESM bundle, default-exports a ServicePlugin
//   view/             browser bundle, served at /api/v1/<id>/view/
//
// The plugin id lives in the manifest (package.json#twodb.identifier,
// e.g. io.twodb.auth) — irrespective of where the bundle came from. The
// registry only keys rows by source; manifest metadata is written back to
// the row as soon as the bundle is readable.
//
// Sources come from the admin plugin registry (sqlite `plugins` table,
// managed at /api/admin/plugins):
//   local:<path>   a built plugin dir (plugins/auth/.build), resolved from
//                  apps/api/src
//   npm:<pkg>      not implemented yet; will download + extract the tarball
//                  into the work dir and hand back the same layout
//   git:<url>      not implemented yet; will clone + build into the work dir
// A row whose extracted_path is set (by the future fetch pipeline) loads
// from that directory instead of its identifier.
export type LoadedPlugin = {
  id: string;
  name: string;
  version: string;
  dir: string;
  manifest: Record<string, unknown>;
};

export function localDirFromIdentifier(identifier: string): string {
  return path.resolve(import.meta.dirname, identifier.slice("local:".length));
}

// Reads the manifest out of a bundle dir. Throws when package.json is
// unreadable or has no twodb.identifier.
export async function readBundle(dir: string): Promise<LoadedPlugin> {
  let pkg: { name?: string; version?: string; twodb?: Record<string, unknown> };
  try {
    pkg = JSON.parse(await fsp.readFile(path.join(dir, "package.json"), "utf8"));
  } catch (err) {
    throw new Error(`plugin at ${dir} has an unreadable package.json: ${err instanceof Error ? err.message : err}`);
  }

  const manifest = pkg.twodb ?? {};
  const id = manifest.identifier;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`plugin at ${dir} has no twodb.identifier`);
  }
  const version = typeof manifest.version === "string" && manifest.version ? manifest.version : (pkg.version ?? "");
  const name = typeof manifest.name === "string" && manifest.name.trim() ? manifest.name : (pkg.name ?? id);

  return { id, name, version, dir, manifest };
}

// Registry columns derived from a bundle manifest.
export function manifestMetadata(bundle: LoadedPlugin): {
  name: string;
  version: string;
  provides: string;
  manifest: string;
} {
  return {
    name: bundle.name,
    version: bundle.version,
    provides: JSON.stringify(Array.isArray(bundle.manifest.provides) ? bundle.manifest.provides : []),
    manifest: JSON.stringify(bundle.manifest),
  };
}

function resolvePluginDir(app: FastifyInstance, identifier: string, extractedPath: string | null): string | null {
  if (extractedPath) {
    return path.isAbsolute(extractedPath) ? extractedPath : path.resolve(path.dirname(app.sqlite.filePath), extractedPath);
  }
  if (identifier.startsWith("local:")) {
    return localDirFromIdentifier(identifier);
  }
  app.log.warn(`plugin "${identifier}" needs the git:/npm: fetch pipeline, which is not implemented yet — skipping`);
  return null;
}

async function mountPlugin(app: FastifyInstance, bundle: LoadedPlugin): Promise<void> {
  const { id, dir } = bundle;

  const serviceFile = path.join(dir, "service", "main.js");
  const mod = (await import(pathToFileURL(serviceFile).href)) as {
    default: ServicePlugin;
  };
  const service = mod.default;

  const db = scopedDb(app, id);
  const migrations = service.migrations ?? {};
  if (Object.keys(migrations).length > 0) {
    await app.db.schema.createSchema(pluginSchemaName(id)).ifNotExists().execute();
    await runPluginMigrations(db, id, migrations);
  }

  const ctx = { db, fn: {} };
  await service.init?.(ctx);

  const routes = service.routes ?? {};
  if (Object.keys(routes).length > 0) {
    await app.register(
      async (scope) => {
        for (const [routePath, methods] of Object.entries(routes)) {
          for (const [method, handler] of Object.entries(methods)) {
            if (!handler) continue;
            scope.route({
              method: method.toUpperCase() as HTTPMethods,
              url: routePath,
              handler: (request) => handler(ctx, request as unknown as Request),
            });
          }
        }
      },
      { prefix: `/api/v1/${id}` },
    );
  }

  const viewDir = path.join(dir, "view");
  if (fs.existsSync(path.join(viewDir, "main.js"))) {
    console.log(`registering view plugin for ${id} on prefix /api/v1/plugins/${id}/view/`);
    await app.register(fastifyStatic, {
      root: viewDir,
      prefix: `/api/v1/plugins/${id}/view/`,
      decorateReply: false,
    });
  }
}

export async function registerServicePlugins(app: FastifyInstance): Promise<void> {
  const entries = await app.sqlite.db.selectFrom("plugins").select(["identifier", "extracted_path"]).orderBy("created_at").execute();

  if (entries.length === 0) {
    app.log.info("plugin registry is empty — no service plugins to load");
  }

  const loaded: LoadedPlugin[] = [];
  const mountedIds = new Set<string>();
  for (const { identifier, extracted_path: extractedPath } of entries) {
    const dir = resolvePluginDir(app, identifier, extractedPath);
    if (!dir) continue;
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      app.log.warn(`plugin "${identifier}" resolved to ${dir}, but there is no package.json there — skipping (build the plugin first)`);
      continue;
    }

    let bundle: LoadedPlugin;
    try {
      bundle = await readBundle(dir);
    } catch (err) {
      app.log.warn(`plugin "${identifier}" at ${dir} has an invalid manifest — skipping: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (mountedIds.has(bundle.id)) {
      app.log.warn(`plugin "${identifier}" declares id ${bundle.id}, already mounted from another source — skipping`);
      continue;
    }
    mountedIds.add(bundle.id);

    await mountPlugin(app, bundle);
    loaded.push(bundle);
    app.log.info(`loaded service plugin ${bundle.id} (${bundle.name}@${bundle.version}) from ${dir}`);

    const { manifest, ...metadata } = manifestMetadata(bundle);
    await app.sqlite.db
      .updateTable("plugins")
      .set({ ...metadata, manifest, updated_at: new Date().toISOString() })
      .where("identifier", "=", identifier)
      .execute();
  }

  app.decorate("loadedPlugins", loaded);
}
