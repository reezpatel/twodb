import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";
import { parseTags, syncLlmTags } from "../lib/llm-tags";

function parsePath(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const instructionRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("instruction").selectAll().where("organizationId", "=", s.organizationId);

    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) {
      query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
    }

    const rows = await query.orderBy("instructionPath", "asc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (typeof body?.instruction !== "string") return c.json({ error: "invalid_instruction" }, 400);
    const instructionPath = parsePath(body?.instructionPath);
    if (instructionPath === "invalid") return c.json({ error: "invalid_instruction_path" }, 400);
    if (typeof body?.hash !== "string" || !body.hash.trim()) return c.json({ error: "invalid_hash" }, 400);
    const tags = parseTags(body?.tags);
    if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    // Rows with a path are upserted by (scope, path); pathless rows always insert.
    if (instructionPath) {
      let existingQuery = db
        .selectFrom("instruction")
        .select("id")
        .where("organizationId", "=", s.organizationId)
        .where("instructionPath", "=", instructionPath);
      existingQuery = scope.codeDirectoryId
        ? existingQuery.where("codeDirectoryId", "=", scope.codeDirectoryId)
        : existingQuery.where("codeDirectoryId", "is", null);
      const existing = await existingQuery.executeTakeFirst();

      if (existing) {
        const row = await db
          .updateTable("instruction")
          .set({ instruction: body.instruction, hash: body.hash.trim(), ...(tags !== undefined ? { tags } : {}), updatedAt: now })
          .where("id", "=", existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        await syncLlmTags(s.organizationId, row.tags);
        return c.json(row, 200);
      }
    }

    const row = await db
      .insertInto("instruction")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: scope.codeDirectoryId,
        instruction: body.instruction,
        instructionPath,
        hash: body.hash.trim(),
        tags: tags ?? [],
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

    const row = await db
      .selectFrom("instruction")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!row) return c.json({ error: "instruction_not_found" }, 404);
    return c.json(row);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("instruction")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "instruction_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ instruction: string; hash: string; instructionPath: string | null; tags: string[] }> = {};
    if (body?.instruction !== undefined) {
      if (typeof body.instruction !== "string") return c.json({ error: "invalid_instruction" }, 400);
      patch.instruction = body.instruction;
    }
    if (body?.hash !== undefined) {
      if (typeof body.hash !== "string" || !body.hash.trim()) return c.json({ error: "invalid_hash" }, 400);
      patch.hash = body.hash.trim();
    }
    if (body?.instructionPath !== undefined) {
      const instructionPath = parsePath(body.instructionPath);
      if (instructionPath === "invalid") return c.json({ error: "invalid_instruction_path" }, 400);
      patch.instructionPath = instructionPath;
    }
    if (body?.tags !== undefined) {
      const tags = parseTags(body.tags);
      if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
      patch.tags = tags ?? [];
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("instruction")
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

    const row = await db.deleteFrom("instruction").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "instruction_not_found" }, 404);
    return c.json({ ok: true });
  });
