import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { localDirFromIdentifier, manifestMetadata, readBundle } from "../../plugins";
import { isValidIdentifier } from "../lib/plugins";
import { requireAdmin } from "../lib/session";

type IdentifierParams = { Params: { identifier: string } };
type IdentifierBody = { Body: { identifier?: string } };

const pluginRoutes: FastifyPluginAsync = async (app) => {
  app.get("/plugins", { preHandler: requireAdmin }, async () => {
    return app.sqlite.db.selectFrom("plugins").selectAll().orderBy("created_at").execute();
  });

  app.post<IdentifierBody>("/plugins", { preHandler: requireAdmin }, async (request, reply) => {
    const identifier = request.body?.identifier?.trim();
    if (!identifier || !isValidIdentifier(identifier)) {
      return reply.code(400).send({
        error: "invalid_identifier",
        message: "Identifier must match git:<url>, npm:<name> or local:<path>",
      });
    }

    const existing = await app.sqlite.db.selectFrom("plugins").select("identifier").where("identifier", "=", identifier).executeTakeFirst();
    if (existing) {
      return reply.code(409).send({ error: "plugin_exists" });
    }

    // The plugin id and its metadata live in the bundle manifest, so fill
    // the row from it whenever the bundle is already readable (local:).
    // git:/npm: stay empty until their fetch pipeline lands.
    let metadata: { name: string; version: string; provides: string; manifest: string } | null = null;
    if (identifier.startsWith("local:")) {
      try {
        metadata = manifestMetadata(await readBundle(localDirFromIdentifier(identifier)));
      } catch (err) {
        return reply.code(400).send({
          error: "plugin_dir_unreadable",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await app.sqlite.db
      .insertInto("plugins")
      .values({
        identifier,
        name: metadata?.name ?? null,
        version: metadata?.version ?? null,
        provides: metadata?.provides ?? "[]",
        manifest: metadata?.manifest ?? null,
      })
      .execute();
    return app.sqlite.db.selectFrom("plugins").selectAll().where("identifier", "=", identifier).executeTakeFirstOrThrow();
  });

  app.delete<IdentifierParams>("/plugins/:identifier", { preHandler: requireAdmin }, async (request, reply) => {
    const row = await app.sqlite.db
      .selectFrom("plugins")
      .select(["identifier", "extracted_path"])
      .where("identifier", "=", request.params.identifier)
      .executeTakeFirst();
    if (!row) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }

    // npm:/git: bundles were fetched into api-owned work-dir folders —
    // delete them with the row. local: dirs are developer files; leave
    // them alone. Absolute paths outside the work dir are never touched.
    if (row.extracted_path && !row.identifier.startsWith("local:")) {
      const workDir = path.dirname(app.sqlite.filePath);
      const dir = path.isAbsolute(row.extracted_path) ? row.extracted_path : path.resolve(workDir, row.extracted_path);
      const rel = path.relative(workDir, dir);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        app.log.warn(`refusing to delete plugin folder outside the work dir: ${dir}`);
      } else {
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }

    await app.sqlite.db.deleteFrom("plugins").where("identifier", "=", request.params.identifier).execute();
    return { ok: true };
  });

  // Stub: later dispatches on the git:/npm: scheme, extracts into
  // $TWO_DB_WORK_DIR/plugins/<slug>/ and populates name/version/provides/
  // manifest from the plugin's metadata.json.
  app.post<IdentifierParams>("/plugins/:identifier/fetch", { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.code(501).send({ error: "not_implemented" });
  });

  app.get("/plugin-templates", { preHandler: requireAdmin }, async () => {
    return app.sqlite.db.selectFrom("plugin_templates").selectAll().orderBy("created_at").execute();
  });

  app.post<IdentifierBody>("/plugin-templates", { preHandler: requireAdmin }, async (request, reply) => {
    const identifier = request.body?.identifier?.trim();
    if (!identifier || !isValidIdentifier(identifier)) {
      return reply.code(400).send({
        error: "invalid_identifier",
        message: "Identifier must match git:<url>, npm:<name> or local:<path>",
      });
    }

    const existing = await app.sqlite.db.selectFrom("plugin_templates").select("identifier").where("identifier", "=", identifier).executeTakeFirst();
    if (existing) {
      return reply.code(409).send({ error: "template_exists" });
    }

    let metadata: { name: string; version: string; provides: string } | null = null;
    if (identifier.startsWith("local:")) {
      try {
        const bundle = await readBundle(localDirFromIdentifier(identifier));
        metadata = { name: bundle.name, version: bundle.version, provides: manifestMetadata(bundle).provides };
      } catch (err) {
        return reply.code(400).send({
          error: "plugin_dir_unreadable",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await app.sqlite.db
      .insertInto("plugin_templates")
      .values({
        identifier,
        name: metadata?.name ?? null,
        version: metadata?.version ?? null,
        provides: metadata?.provides ?? "[]",
      })
      .execute();
    return app.sqlite.db.selectFrom("plugin_templates").selectAll().where("identifier", "=", identifier).executeTakeFirstOrThrow();
  });

  app.delete<IdentifierParams>("/plugin-templates/:identifier", { preHandler: requireAdmin }, async (request, reply) => {
    const result = await app.sqlite.db.deleteFrom("plugin_templates").where("identifier", "=", request.params.identifier).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      return reply.code(404).send({ error: "template_not_found" });
    }
    return { ok: true };
  });
};

export default pluginRoutes;
