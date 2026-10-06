import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";

/**
 * Per-user UI preferences (bottom bar, etc.). Value JSON is owned by the client;
 * upsert is keyed by (organizationId, userId, key).
 */
export const footerPreferenceRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);

    const rows = await db
      .selectFrom("footer_preference")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .execute();
    return c.json(rows);
  })

  .put("/:key", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);

    const key = c.req.param("key").trim();
    if (!key || key.length > 64) return c.json({ error: "invalid_key" }, 400);

    const value = await c.req.json().catch(() => null);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return c.json({ error: "invalid_value" }, 400);

    const existing = await db
      .selectFrom("footer_preference")
      .select("id")
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .where("key", "=", key)
      .executeTakeFirst();

    const now = new Date();
    if (existing) {
      const row = await db
        .updateTable("footer_preference")
        .set({ value: JSON.stringify(value), updatedAt: now })
        .where("id", "=", existing.id)
        // onConflict().doUpdateSet() has no returningAll — select back after write
        .returningAll()
        .executeTakeFirstOrThrow();
      return c.json(row);
    }

    const row = await db
      .insertInto("footer_preference")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        userId: s.session.user.id,
        key,
        value: JSON.stringify(value),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .delete("/:key", async (c) => {
    const s = await requireOrgSession(c);
    if (!s?.session) return c.json({ error: "unauthorized" }, 401);

    await db
      .deleteFrom("footer_preference")
      .where("organizationId", "=", s.organizationId)
      .where("userId", "=", s.session.user.id)
      .where("key", "=", c.req.param("key"))
      .execute();
    return c.json({ ok: true });
  });
