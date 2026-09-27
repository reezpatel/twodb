import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { runnerManager } from "../lib/runner-manager";

export const runnerRoutes = new Hono()
  .get("/runners", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db.selectFrom("runner").selectAll().where("organizationId", "=", s.organizationId).where("deletedAt", "is", null).execute();

    const online = runnerManager.onlineIds();
    const runners = rows
      .map((r) => ({ ...r, online: online.has(r.id) }))
      .sort((a, b) => Number(b.online) - Number(a.online) || +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt));
    return c.json(runners);
  })

  .delete("/runners/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .updateTable("runner")
      .set({ deletedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .where("deletedAt", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "runner_not_found" }, 404);

    runnerManager.disconnect(row.id);
    return c.json({ ok: true });
  })

  .get("/runner-keys", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db
      .selectFrom("runner_access_key")
      .select(["id", "name", "key", "createdAt", "revokedAt"])
      .where("organizationId", "=", s.organizationId)
      .orderBy("createdAt", "desc")
      .execute();
    return c.json(rows.map(({ key, ...rest }) => ({ ...rest, prefix: key.slice(0, 12) })));
  })

  .post("/runner-keys", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "default";

    const row = await db
      .insertInto("runner_access_key")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        name,
        key: `twr_${crypto.randomUUID().replaceAll("-", "")}`,
        createdAt: new Date(),
        revokedAt: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .delete("/runner-keys/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .updateTable("runner_access_key")
      .set({ revokedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .where("revokedAt", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "key_not_found" }, 404);
    return c.json({ ok: true });
  });
