import type { FastifyPluginAsync } from "fastify";
import authRoutes from "./routes/auth";
import passkeyRoutes from "./routes/passkeys";
import instanceRoutes from "./routes/instance";
import pluginRoutes from "./routes/plugins";

// Admin api, mounted by the host at /api/admin. Backed by the api-owned
// sqlite database (fastify.sqlite, src/db/sqlite.ts). See plan.md.
const adminRoutes: FastifyPluginAsync = async (app) => {
	app.get("/status", async () => {
		return {
			status: "ok",
			database: {
				filePath: app.sqlite.filePath,
				appliedMigrations: app.sqlite.appliedMigrations,
			},
		};
	});

	await app.register(authRoutes);
	await app.register(passkeyRoutes);
	await app.register(instanceRoutes);
	await app.register(pluginRoutes);
};

export default adminRoutes;
