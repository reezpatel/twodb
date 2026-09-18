import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { isValidIdentifier } from "../lib/plugins";
import { requireAdmin } from "../lib/session";

type IdentifierParams = { Params: { identifier: string } };
type IdentifierBody = { Body: { identifier?: string } };

const pluginRoutes: FastifyPluginAsync = async (app) => {
  app.get("/plugins", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_plugins").selectAll().orderBy("created_at").execute();
  });

  // app.post<IdentifierBody>("/plugins", { preHandler: requireAdmin }, async (request, reply) => {
  //   const identifier = request.body?.identifier?.trim();
  //   if (!identifier || !isValidIdentifier(identifier)) {
  //     return reply.code(400).send({
  //       error: "invalid_identifier",
  //       message: "Identifier must match git:<url>, npm:<name> or local:<path>",
  //     });
  //   }

  //   const existing = await app.db.selectFrom("plugins").select("identifier").where("identifier", "=", identifier).executeTakeFirst();
  //   if (existing) {
  //     return reply.code(409).send({ error: "plugin_exists" });
  //   }

  //   // The plugin id and its metadata live in the bundle manifest, so fill
  //   // the row from it whenever the bundle is already readable (local:).
  //   // git:/npm: stay empty until their fetch pipeline lands.
  //   let metadata: { name: string; version: string; provides: string; manifest: string } | null = null;
  //   if (identifier.startsWith("local:")) {
  //     try {
  //       metadata = manifestMetadata(await readBundle(localDirFromIdentifier(identifier)));
  //     } catch (err) {
  //       return reply.code(400).send({
  //         error: "plugin_dir_unreadable",
  //         message: err instanceof Error ? err.message : String(err),
  //       });
  //     }
  //   }

  //   awaitapp.db
  //     .insertInto("plugins")
  //     .values({
  //       identifier,
  //       name: metadata?.name ?? null,
  //       version: metadata?.version ?? null,
  //       provides: metadata?.provides ?? "[]",
  //       manifest: metadata?.manifest ?? null,
  //     })
  //     .execute();
  //   return app.db.selectFrom("plugins").selectAll().where("identifier", "=", identifier).executeTakeFirstOrThrow();
  // });

  // app.delete<IdentifierParams>("/plugins/:identifier", { preHandler: requireAdmin }, async (request, reply) => {
  //   const row = await app.db
  //     .selectFrom("plugins")
  //     .select(["identifier", "extracted_path"])
  //     .where("identifier", "=", request.params.identifier)
  //     .executeTakeFirst();
  //   if (!row) {
  //     return reply.code(404).send({ error: "plugin_not_found" });
  //   }

  //   // npm:/git: bundles were fetched into api-owned work-dir folders —
  //   // delete them with the row. local: dirs are developer files; leave
  //   // them alone. Absolute paths outside the work dir are never touched.
  //   if (row.extracted_path && !row.identifier.startsWith("local:")) {
  //     const workDir = apiWorkDir(app);
  //     const dir = path.isAbsolute(row.extracted_path) ? row.extracted_path : path.resolve(workDir, row.extracted_path);
  //     const rel = path.relative(workDir, dir);
  //     if (rel.startsWith("..") || path.isAbsolute(rel)) {
  //       app.log.warn(`refusing to delete plugin folder outside the work dir: ${dir}`);
  //     } else {
  //       await fsp.rm(dir, { recursive: true, force: true });
  //     }
  //   }

  //   await app.db.deleteFrom("plugins").where("identifier", "=", request.params.identifier).execute();
  //   return { ok: true };
  // });

  app.post<IdentifierParams>("/plugins/:identifier/fetch", { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.code(501).send({ error: "not_implemented" });
  });

  app.get("/plugin-templates", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_plugin_templates").selectAll().orderBy("created_at").execute();
  });
};

export default pluginRoutes;
