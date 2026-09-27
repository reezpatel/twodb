import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";

export const skillRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("skill").selectAll().where("organizationId", "=", s.organizationId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) {
      query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
    }

    const rows = await query.orderBy("name", "asc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
    if (typeof body?.description !== "string") return c.json({ error: "invalid_description" }, 400);
    if (typeof body?.content !== "string") return c.json({ error: "invalid_content" }, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    const row = await db
      .insertInto("skill")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: scope.codeDirectoryId,
        name: body.name.trim(),
        description: body.description,
        content: body.content,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .get("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.selectFrom("skill").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "skill_not_found" }, 404);
    return c.json(row);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("skill")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "skill_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; description: string; content: string }> = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
      patch.name = body.name.trim();
    }
    if (body?.description !== undefined) {
      if (typeof body.description !== "string") return c.json({ error: "invalid_description" }, 400);
      patch.description = body.description;
    }
    if (body?.content !== undefined) {
      if (typeof body.content !== "string") return c.json({ error: "invalid_content" }, 400);
      patch.content = body.content;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("skill")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("skill").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "skill_not_found" }, 404);
    return c.json({ ok: true });
  });
