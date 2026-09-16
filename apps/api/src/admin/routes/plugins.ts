import type { FastifyPluginAsync } from "fastify";
import { isValidIdentifier, nameFromIdentifier } from "../lib/plugins";
import { requireAdmin } from "../lib/session";

type IdentifierParams = { Params: { identifier: string } };
type IdentifierBody = { Body: { identifier?: string } };

const pluginRoutes: FastifyPluginAsync = async (app) => {
	app.get("/plugins", { preHandler: requireAdmin }, async () => {
		return app.sqlite.db
			.selectFrom("plugins")
			.selectAll()
			.orderBy("created_at")
			.execute();
	});

	app.post<IdentifierBody>(
		"/plugins",
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const identifier = request.body?.identifier?.trim();
			if (!identifier || !isValidIdentifier(identifier)) {
				return reply.code(400).send({
					error: "invalid_identifier",
					message: "Identifier must match git:<url> or npm:<name>",
				});
			}

			const existing = await app.sqlite.db
				.selectFrom("plugins")
				.select("identifier")
				.where("identifier", "=", identifier)
				.executeTakeFirst();
			if (existing) {
				return reply.code(409).send({ error: "plugin_exists" });
			}

			await app.sqlite.db
				.insertInto("plugins")
				.values({ identifier, name: nameFromIdentifier(identifier) })
				.execute();
			return app.sqlite.db
				.selectFrom("plugins")
				.selectAll()
				.where("identifier", "=", identifier)
				.executeTakeFirstOrThrow();
		},
	);

	app.delete<IdentifierParams>(
		"/plugins/:identifier",
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const result = await app.sqlite.db
				.deleteFrom("plugins")
				.where("identifier", "=", request.params.identifier)
				.executeTakeFirst();
			if (result.numDeletedRows === 0n) {
				return reply.code(404).send({ error: "plugin_not_found" });
			}
			return { ok: true };
		},
	);

	// Stub: later dispatches on the git:/npm: scheme, extracts into
	// $TWO_DB_WORK_DIR/plugins/<slug>/ and populates name/version/provides/
	// manifest from the plugin's metadata.json.
	app.post<IdentifierParams>(
		"/plugins/:identifier/fetch",
		{ preHandler: requireAdmin },
		async (_request, reply) => {
			return reply.code(501).send({ error: "not_implemented" });
		},
	);

	app.get("/plugin-templates", { preHandler: requireAdmin }, async () => {
		return app.sqlite.db
			.selectFrom("plugin_templates")
			.selectAll()
			.orderBy("created_at")
			.execute();
	});

	app.post<IdentifierBody>(
		"/plugin-templates",
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const identifier = request.body?.identifier?.trim();
			if (!identifier || !isValidIdentifier(identifier)) {
				return reply.code(400).send({
					error: "invalid_identifier",
					message: "Identifier must match git:<url> or npm:<name>",
				});
			}

			const existing = await app.sqlite.db
				.selectFrom("plugin_templates")
				.select("identifier")
				.where("identifier", "=", identifier)
				.executeTakeFirst();
			if (existing) {
				return reply.code(409).send({ error: "template_exists" });
			}

			await app.sqlite.db
				.insertInto("plugin_templates")
				.values({ identifier, name: nameFromIdentifier(identifier) })
				.execute();
			return app.sqlite.db
				.selectFrom("plugin_templates")
				.selectAll()
				.where("identifier", "=", identifier)
				.executeTakeFirstOrThrow();
		},
	);

	app.delete<IdentifierParams>(
		"/plugin-templates/:identifier",
		{ preHandler: requireAdmin },
		async (request, reply) => {
			const result = await app.sqlite.db
				.deleteFrom("plugin_templates")
				.where("identifier", "=", request.params.identifier)
				.executeTakeFirst();
			if (result.numDeletedRows === 0n) {
				return reply.code(404).send({ error: "template_not_found" });
			}
			return { ok: true };
		},
	);
};

export default pluginRoutes;
