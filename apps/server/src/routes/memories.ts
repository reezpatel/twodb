import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";
import type { MemoryScope } from "../plugins/db";

function parseScope(value: unknown): MemoryScope | "invalid" {
  if (value === undefined || value === null) return "workspace";
  if (value === "workspace" || value === "project" || value === "session") return value;
  return "invalid";
}

export const memoryRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("memory").selectAll().where("organizationId", "=", s.organizationId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) {
      query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
    }

    const scopeId = c.req.query("scopeId");
    if (scopeId !== undefined) query = query.where("scopeId", "=", scopeId);

    const scopeFilter = c.req.query("scope");
    if (scopeFilter) {
      const parsed = parseScope(scopeFilter);
      if (parsed !== "invalid") query = query.where("scope", "=", parsed);
    }

    const q = c.req.query("q");
    if (q) query = query.where("content", "ilike", `%${q}%`);

    const rows = await query.orderBy("createdAt", "desc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (body?.scopeId !== undefined && body.scopeId !== null && typeof body.scopeId !== "string") {
      return c.json({ error: "invalid_scope" }, 400);
    }
    if (body?.scopeId === "") return c.json({ error: "invalid_scope" }, 400);
    const memoryScope = parseScope(body?.scope);
    if (memoryScope === "invalid") return c.json({ error: "invalid_scope" }, 400);
    if (typeof body?.content !== "string" || !body.content.trim()) return c.json({ error: "invalid_content" }, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    const row = await db
      .insertInto("memory")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: scope.codeDirectoryId,
        scopeId: typeof body.scopeId === "string" && body.scopeId ? body.scopeId : null,
        scope: memoryScope,
        content: body.content.trim(),
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

    const row = await db.selectFrom("memory").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "memory_not_found" }, 404);
    return c.json(row);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("memory")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "memory_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ scopeId: string | null; scope: MemoryScope; content: string }> = {};
    if (body?.scopeId !== undefined) {
      if (body.scopeId !== null && (typeof body.scopeId !== "string" || !body.scopeId)) {
        return c.json({ error: "invalid_scope" }, 400);
      }
      patch.scopeId = body.scopeId;
    }
    if (body?.scope !== undefined) {
      const parsed = parseScope(body.scope);
      if (parsed === "invalid") return c.json({ error: "invalid_scope" }, 400);
      patch.scope = parsed;
    }
    if (body?.content !== undefined) {
      if (typeof body.content !== "string" || !body.content.trim()) return c.json({ error: "invalid_content" }, 400);
      patch.content = body.content.trim();
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("memory")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("memory").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "memory_not_found" }, 404);
    return c.json({ ok: true });
  });
