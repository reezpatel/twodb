import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";

/**
 * Spaces — user-defined groupings inside an organization. Org-scoped CRUD;
 * per-user selection lives client-side and rides APIs via the `x-space-ids`
 * header (see lib/spaces.ts). Filtering per resource comes later.
 */
export const spaceRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const rows = await db
      .selectFrom("space")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .orderBy("name", "asc")
      .execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 64) return c.json({ error: "invalid_name" }, 400);

    const existing = await db
      .selectFrom("space")
      .select("id")
      .where("organizationId", "=", s.organizationId)
      .where("name", "=", name)
      .executeTakeFirst();
    if (existing) return c.json({ error: "space_exists" }, 400);

    const now = new Date();
    const row = await db
      .insertInto("space")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, name, createdAt: now, updatedAt: now })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 64) return c.json({ error: "invalid_name" }, 400);

    const existing = await db
      .selectFrom("space")
      .select("id")
      .where("organizationId", "=", s.organizationId)
      .where("name", "=", name)
      .executeTakeFirst();
    if (existing && existing.id !== c.req.param("id")) return c.json({ error: "space_exists" }, 400);

    const row = await db
      .updateTable("space")
      .set({ name, updatedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returningAll()
      .executeTakeFirst();
    if (!row) return c.json({ error: "space_not_found" }, 404);
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const deleted = await db
      .deleteFrom("space")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!deleted) return c.json({ error: "space_not_found" }, 404);
    return c.json({ ok: true });
  });