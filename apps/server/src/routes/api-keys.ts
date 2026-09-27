import { Hono } from "hono";
import { auth, db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { generateApiKey } from "../lib/api-keys";

export const apiKeyRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db
      .selectFrom("api_key")
      .select(["id", "name", "prefix", "lastUsedAt", "revokedAt", "createdAt"])
      .where("organizationId", "=", s.organizationId)
      .orderBy("createdAt", "desc")
      .execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const userId = session?.user.id;
    if (!userId) return c.json({ error: "session_required" }, 401);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "invalid_name" }, 400);

    const { key, prefix, hash } = generateApiKey();
    const now = new Date();
    const row = await db
      .insertInto("api_key")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        userId,
        name,
        prefix,
        hash,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return c.json({ id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt, key }, 201);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db
      .updateTable("api_key")
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .where("revokedAt", "is", null)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "key_not_found" }, 404);
    return c.json({ ok: true });
  });
