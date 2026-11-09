import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { validateSpaceId, spaceMatches, getDirectorySpaceId } from "../lib/spaces";
import { resolveScope } from "../lib/code-directory";
import { parseTags, syncLlmTags } from "../lib/llm-tags";

export const skillRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("skill").selectAll().where("organizationId", "=", s.organizationId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    let directorySpaceId: string | null = null;
    if (codeDirectoryId) {
      query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
      // Session-scoped view (composer palette, code chat): the directory's
      // space gates the list, same as the agent runtime's matching. Without the
      // param (settings UI) everything is shown.
      directorySpaceId = await getDirectorySpaceId(s.organizationId, codeDirectoryId);
    }

    const rows = await query.orderBy("name", "asc").execute();
    const filtered = directorySpaceId !== null ? rows.filter((r) => spaceMatches(r.spaceId, directorySpaceId)) : rows;
    return c.json(filtered);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (body?.id !== undefined && (typeof body.id !== "string" || !body.id.trim() || body.id.length > 64)) return c.json({ error: "invalid_id" }, 400);
    if (typeof body?.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
    if (typeof body?.description !== "string") return c.json({ error: "invalid_description" }, 400);
    if (typeof body?.content !== "string") return c.json({ error: "invalid_content" }, 400);
    const tags = parseTags(body?.tags);
    if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);
    if (body?.aiVisible !== undefined && typeof body.aiVisible !== "boolean") return c.json({ error: "invalid_ai_visible" }, 400);
    const space = await validateSpaceId(s.organizationId, body?.spaceId);
    if (!space.ok) return c.json({ error: space.error }, 400);

    const now = new Date();
    const row = await db
      .insertInto("skill")
      .values({
        id: typeof body?.id === "string" && body.id.trim() ? body.id.trim() : crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: scope.codeDirectoryId,
        spaceId: space.spaceId,
        name: body.name.trim(),
        description: body.description,
        content: body.content,
        tags: tags ?? [],
        aiVisible: body?.aiVisible ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await syncLlmTags(s.organizationId, row.tags);
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
    const patch: Partial<{ name: string; description: string; content: string; tags: string[]; aiVisible: boolean; spaceId: string | null }> = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) return c.json({ error: "invalid_name" }, 400);
      patch.name = body.name.trim();
    }
    if (body?.spaceId !== undefined) {
      const space = await validateSpaceId(s.organizationId, body.spaceId);
      if (!space.ok) return c.json({ error: space.error }, 400);
      patch.spaceId = space.spaceId;
    }
    if (body?.description !== undefined) {
      if (typeof body.description !== "string") return c.json({ error: "invalid_description" }, 400);
      patch.description = body.description;
    }
    if (body?.content !== undefined) {
      if (typeof body.content !== "string") return c.json({ error: "invalid_content" }, 400);
      patch.content = body.content;
    }
    if (body?.tags !== undefined) {
      const tags = parseTags(body.tags);
      if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
      patch.tags = tags ?? [];
    }
    if (body?.aiVisible !== undefined) {
      if (typeof body.aiVisible !== "boolean") return c.json({ error: "invalid_ai_visible" }, 400);
      patch.aiVisible = body.aiVisible;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("skill")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await syncLlmTags(s.organizationId, row.tags);
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const row = await db.deleteFrom("skill").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "skill_not_found" }, 404);
    return c.json({ ok: true });
  });
