import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../lib/session";

const instanceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/instance", { preHandler: requireAdmin }, async () => {
    return app.db.selectFrom("admin_instance").selectAll().limit(1).executeTakeFirstOrThrow();
  });

  app.patch<{ Body: { name?: string } }>("/instance", { preHandler: requireAdmin }, async (request, reply) => {
    const name = request.body?.name?.trim();
    if (!name) {
      return reply.code(400).send({ error: "missing_name" });
    }
    await app.db.updateTable("admin_instance").set({ name }).execute();
    return app.db.selectFrom("admin_instance").selectAll().limit(1).executeTakeFirstOrThrow();
  });
};

export default instanceRoutes;
