import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { sql } from "kysely";

// Baked deployments (docker image, tarball, nix) point TWODB_PLUGINS_DIR at a
// directory of plugin folders; any missing registry rows are seeded from
// their .build manifests so a fresh database boots fully loaded. Must run
// after the admin migrations (admin_plugins) and before plugin loading.
export async function seedBakedPlugins(app: FastifyInstance): Promise<void> {
  if (!app.config.TWODB_PLUGINS_DIR) return;

  const pluginsDir = app.config.TWODB_PLUGINS_DIR;
  for (const entry of fs.existsSync(pluginsDir) ? fs.readdirSync(pluginsDir) : []) {
    const manifestPath = path.join(pluginsDir, entry, ".build", "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    let pkg: { name?: string; version?: string; twodb?: { identifier?: string; provides?: string[]; requires?: string[] } };
    try {
      pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      app.log.warn(`invalid plugin manifest at ${manifestPath} — skipping seed`);
      continue;
    }
    if (!pkg.twodb?.identifier) continue;

    await app.db
      .insertInto("admin_plugins")
      .values({
        identifier: pkg.twodb.identifier,
        name: pkg.name ?? "",
        version: pkg.version ?? "0.0.0",
        extracted_path: path.join(pluginsDir, entry, ".build"),
        provides: sql`${JSON.stringify(pkg.twodb.provides ?? [])}::jsonb` as never,
        manifest: sql`${JSON.stringify({ ...pkg.twodb })}::jsonb` as never,
      })
      .onConflict((qb) => qb.doNothing())
      .execute();
    app.log.info(`seeded plugin registry row for ${pkg.twodb.identifier}`);
  }
}
