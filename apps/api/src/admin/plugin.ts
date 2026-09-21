import type { FastifyInstance } from "fastify/types/instance";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
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

async function loadService(bundle: LoadedPlugin): Promise<ServicePlugin> {
  const serviceFile = path.join(bundle.dir, "service", "main.js");
  const mod = (await import(pathToFileURL(serviceFile).href)) as {
    default: ServicePlugin;
  };
  return mod.default;
}

type Loaded = { identifier: string; bundle: LoadedPlugin; service: ServicePlugin };

// orders plugins so every `requires` (a provides capability or a plugin id)
// is setup/init-ed before its dependents. Plugins with missing or skipped
// dependencies are skipped with a warning instead of crashing the boot.
function orderPlugins(app: FastifyInstance, loaded: Loaded[]): Loaded[] {
  const byCapability = new Map<string, Loaded>();
  const byIdentifier = new Map<string, Loaded>();
  for (const entry of loaded) {
    byIdentifier.set(entry.bundle.manifest.twodb.identifier, entry);
    for (const capability of entry.bundle.manifest.twodb.provides ?? []) {
      if (!byCapability.has(capability)) byCapability.set(capability, entry);
    }
  }

  const depsOf = new Map<Loaded, Loaded[]>();
  const skipped = new Set<Loaded>();
  for (const entry of loaded) {
    const deps: Loaded[] = [];
    for (const requirement of entry.bundle.manifest.twodb.requires ?? []) {
      const dep = byCapability.get(requirement) ?? byIdentifier.get(requirement);
      if (!dep) {
        app.log.warn(`plugin ${entry.bundle.manifest.twodb.identifier} requires "${requirement}" — not installed, skipping plugin`);
        skipped.add(entry);
      } else if (dep !== entry) {
        deps.push(dep);
      }
    }
    depsOf.set(entry, deps);
  }

  const ordered: Loaded[] = [];
  const settled = new Set<Loaded>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const entry of loaded) {
      if (settled.has(entry)) continue;
      const deps = depsOf.get(entry) ?? [];
      if (!deps.every((dep) => settled.has(dep))) continue;
      if (skipped.has(entry) || deps.some((dep) => skipped.has(dep))) {
        skipped.add(entry);
      } else {
        ordered.push(entry);
      }
      settled.add(entry);
      progress = true;
    }
  }

  for (const entry of loaded) {
    if (!settled.has(entry)) {
      app.log.warn(`plugin ${entry.bundle.manifest.twodb.identifier} is in a requires cycle — skipping`);
    }
  }

  return ordered;
}

async function mountPlugin(app: FastifyInstance, bundle: LoadedPlugin, service: ServicePlugin): Promise<void> {
  const { manifest, dir } = bundle;
  void dir;

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
}

const NPM_REGISTRY = process.env.TWODB_NPM_REGISTRY ?? "https://registry.npmjs.org";

const fetchNpmPlugin = async (app: FastifyInstance, name: string): Promise<string> => {
  const encoded = name.startsWith("@") ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
  const metaResponse = await fetch(`${NPM_REGISTRY}/${encoded}`);
  if (!metaResponse.ok) throw new Error(`npm registry lookup failed for ${name}: ${metaResponse.status}`);
  const meta = (await metaResponse.json()) as {
    "dist-tags"?: { latest?: string };
    versions?: Record<string, { dist?: { tarball?: string } }>;
  };
  const version = meta["dist-tags"]?.latest;
  const tarball = version ? meta.versions?.[version]?.dist?.tarball : null;
  if (!version || !tarball) throw new Error(`npm registry has no latest version for ${name}`);

  const workDir = app.config.TWODB_WORK_DIR;
  const target = path.join(workDir, "plugins", `${name.replace("/", "+")}-${version}`);
  if (fs.existsSync(path.join(target, "package.json"))) return target;

  const tgz = path.join(workDir, "cache", `${name.replace("/", "+")}-${version}.tgz`);
  await fs.promises.mkdir(path.dirname(tgz), { recursive: true });
  const tarballResponse = await fetch(tarball);
  if (!tarballResponse.ok) throw new Error(`tarball download failed for ${name}@${version}: ${tarballResponse.status}`);
  await fs.promises.writeFile(tgz, Buffer.from(await tarballResponse.arrayBuffer()));

  await fs.promises.mkdir(target, { recursive: true });
  execFileSync("tar", ["-xzf", tgz, "-C", target, "--strip-components=1"]);
  return target;
};

const resolvePluginDir = async (app: FastifyInstance, identifier: string, extractedPath = ""): Promise<string | null> => {
  if (identifier.startsWith("local:")) {
    return path.resolve(app.config.TWODB_WORK_DIR, identifier.slice("local:".length));
  }
  if (identifier.startsWith("npm:")) {
    try {
      return await fetchNpmPlugin(app, identifier.slice("npm:".length));
    } catch (error) {
      app.log.warn(`npm fetch failed for ${identifier}: ${error instanceof Error ? error.message : String(error)} — skipping`);
      return null;
    }
  }

  const p = extractedPath;
  if (p) {
    const workDir = app.config.TWODB_WORK_DIR;
    return path.isAbsolute(p) ? p : path.resolve(workDir, p);
  }

  // TODO: git:<url> fetch pipeline
  app.log.warn(`plugin "${identifier}" needs the git: fetch pipeline, which is not implemented yet — skipping`);

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

  const fnRegistry = new Map<string, (...args: unknown[]) => unknown>();
  await app.decorate("invoke", ((name: string, ...args: unknown[]) => {
    const fn = fnRegistry.get(name);
    if (!fn) throw new Error(`invoke: unknown function "${name}"`);
    return fn(...args);
  }) as FastifyInstance["invoke"]);

  const loaded: Loaded[] = [];

  for (const { identifier, extracted_path: extractedPath } of entries) {
    const bundle = await getPluginBundle(app, identifier, extractedPath || "");

    if (!bundle) continue;

    const service = await loadService(bundle);

    for (const [name, fn] of Object.entries(service.functions ?? {})) {
      if (fnRegistry.has(name)) app.log.warn(`plugin function "${name}" re-registered by ${bundle.manifest.name} — overriding`);
      fnRegistry.set(name, fn as (...args: unknown[]) => unknown);
    }

    loaded.push({ identifier, bundle, service });
  }

  const ordered = orderPlugins(app, loaded);

  for (const { bundle, service } of ordered) {
    const pluginId = bundle.manifest.twodb.identifier;
    const ctx = { db: app.db as unknown as Kysely<unknown>, fn: {}, pluginId };
    await service.setup?.(ctx, app);
  }

  const mounted: LoadedPlugin[] = [];

  for (const { identifier, bundle, service } of ordered) {
    await mountPlugin(app, bundle, service);
    mounted.push(bundle);

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

  return mounted;
}
