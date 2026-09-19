import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { sql } from "kysely";
import { isValidIdentifier } from "../lib/plugins";
import { requireAdmin } from "../lib/session";
import { getPluginBundle } from "../plugin";

type IdentifierParams = { Params: { identifier: string } };
type IdentifierBody = { Body: { identifier?: string } };

const pluginRoutes: FastifyPluginAsync = async (app) => {
  app.get("/plugins", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_plugins").selectAll().orderBy("created_at").execute();
  });

  app.post<IdentifierBody>("/plugins", { preHandler: requireAdmin }, async (request, reply) => {
    const identifier = request.body?.identifier?.trim();

    if (!identifier || !isValidIdentifier(identifier)) {
      return reply.code(400).send({
        error: "invalid_identifier",
        message: "Identifier must match git:<url>, npm:<name> or local:<path>",
      });
    }

    const existing = await app.db.selectFrom("admin_plugins").select("identifier").where("identifier", "=", identifier).executeTakeFirst();

    if (existing) {
      return reply.code(409).send({ error: "plugin_exists" });
    }

    if (identifier.startsWith("local:")) {
      const bundle = await getPluginBundle(app, identifier);

      if (!bundle) {
        return reply.code(400).send({
          error: "plugin_bundle_unreadable",
          message: "Plugin bundle is not readable",
        });
      }

      await app.db
        .insertInto("admin_plugins")
        .values({
          identifier: bundle.manifest.twodb.identifier,
          name: bundle?.manifest.name,
          version: bundle?.manifest.version ?? null,
          provides: JSON.stringify(bundle?.manifest?.twodb?.provides ?? []),
          manifest: bundle?.manifest ?? null,
        })
        .execute();

      return app.db.selectFrom("admin_plugins").selectAll().where("identifier", "=", bundle.manifest.twodb.identifier).executeTakeFirstOrThrow();
    }

    return reply.code(500).send({
      error: "internal_error",
      message: "Failed to insert plugin into database",
    });
  });

  app.patch<IdentifierParams & { Body: { config?: unknown } }>("/plugins/:identifier/config", { preHandler: requireAdmin }, async (request, reply) => {
    const { config } = request.body ?? {};
    if (typeof config !== "object" || config === null) {
      return reply.code(400).send({ error: "invalid_config", message: "config must be a JSON object" });
    }
    const updated = await app.db
      .updateTable("admin_plugins")
      .set({ config: sql`${JSON.stringify(config)}::jsonb`, updated_at: new Date() })
      .where("identifier", "=", request.params.identifier)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }
    return updated;
  });

  app.delete<IdentifierParams>("/plugins/:identifier", { preHandler: requireAdmin }, async (request, reply) => {
    const row = await app.db
      .selectFrom("admin_plugins")
      .select(["identifier", "extracted_path"])
      .where("identifier", "=", request.params.identifier)
      .executeTakeFirst();
    if (!row) {
      return reply.code(404).send({ error: "plugin_not_found" });
    }

    if (row.extracted_path && !row.identifier.startsWith("local:")) {
      await fsp.rm(path.resolve(app.config.TWODB_WORK_DIR, row.extracted_path), { recursive: true, force: true });
    }

    await app.db.deleteFrom("admin_plugins").where("identifier", "=", request.params.identifier).execute();
    return { ok: true };
  });

  app.post<IdentifierParams>("/plugins/:identifier/fetch", { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.code(501).send({ error: "not_implemented" });
  });

  app.get("/plugin-templates", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_plugin_templates").selectAll().orderBy("created_at").execute();
  });
};

export default pluginRoutes;
