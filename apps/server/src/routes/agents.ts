import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";

export const agentRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("agent").selectAll().where("organizationId", "=", s.organizationId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) {
      query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
    }

    const rows = await query.orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.provider !== "string" || !body.provider.trim()) return c.json({ error: "invalid_provider" }, 400);
    if (typeof body?.model !== "string" || !body.model.trim()) return c.json({ error: "invalid_model" }, 400);
    if (body?.description !== undefined && body.description !== null && typeof body.description !== "string") {
      return c.json({ error: "invalid_description" }, 400);
    }
    if (typeof body?.instruction !== "string") return c.json({ error: "invalid_instruction" }, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    const row = await db
      .insertInto("agent")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: scope.codeDirectoryId,
        provider: body.provider.trim(),
        model: body.model.trim(),
        description: typeof body.description === "string" && body.description ? body.description : null,
        instruction: body.instruction,
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

    const row = await db.selectFrom("agent").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "agent_not_found" }, 404);
    return c.json(row);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("agent")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "agent_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ provider: string; model: string; description: string | null; instruction: string }> = {};
    if (body?.provider !== undefined) {
      if (typeof body.provider !== "string" || !body.provider.trim()) return c.json({ error: "invalid_provider" }, 400);
      patch.provider = body.provider.trim();
    }
    if (body?.model !== undefined) {
      if (typeof body.model !== "string" || !body.model.trim()) return c.json({ error: "invalid_model" }, 400);
      patch.model = body.model.trim();
    }
    if (body?.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") {
        return c.json({ error: "invalid_description" }, 400);
      }
      patch.description = body.description && body.description.trim() ? body.description : null;
    }
    if (body?.instruction !== undefined) {
      if (typeof body.instruction !== "string") return c.json({ error: "invalid_instruction" }, 400);
      patch.instruction = body.instruction;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("agent")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("agent").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "agent_not_found" }, 404);
    return c.json({ ok: true });
  });
