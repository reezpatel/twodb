import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { validateSpaceId } from "../lib/spaces";
import { resolveScope } from "../lib/code-directory";
import type { MemoryScope } from "../plugins/db";
import { listSessionMemories, normalizeContent, normalizeTitle, titleTaken, type MemoryPlace } from "../lib/memory";

/** Accepts the legacy names (workspace, project) so older clients keep working. */
function parseScope(value: unknown): MemoryScope | "invalid" {
  if (value === undefined || value === null) return "organization";
  if (value === "organization" || value === "workspace") return "organization";
  if (value === "code_directory" || value === "project") return "code_directory";
  if (value === "agent" || value === "session") return value;
  return "invalid";
}

/**
 * Normalizes the owner fields to what the scope allows and validates them:
 * code_directory needs a directory, agent needs a non-sub_agent agent of the
 * org, session needs a session id; organization carries none of them.
 */
async function resolvePlace(
  organizationId: string,
  scope: MemoryScope,
  input: { codeDirectoryId?: unknown; agentId?: unknown; scopeId?: unknown },
): Promise<{ ok: true; place: MemoryPlace } | { ok: false; error: string; status: 400 | 404 }> {
  const base = { organizationId, scope, codeDirectoryId: null, agentId: null, scopeId: null } as MemoryPlace;
  if (scope === "code_directory") {
    if (typeof input.codeDirectoryId !== "string" || !input.codeDirectoryId) return { ok: false, error: "directory_required", status: 400 };
    const dir = await resolveScope(db, organizationId, input.codeDirectoryId);
    if (!dir.ok) return { ok: false, error: dir.error, status: dir.error === "directory_not_found" ? 404 : 400 };
    return { ok: true, place: { ...base, codeDirectoryId: dir.codeDirectoryId } };
  }
  if (scope === "agent") {
    if (typeof input.agentId !== "string" || !input.agentId) return { ok: false, error: "agent_required", status: 400 };
    const agent = await db.selectFrom("agent").select(["id", "type"]).where("id", "=", input.agentId).where("organizationId", "=", organizationId).executeTakeFirst();
    if (!agent) return { ok: false, error: "agent_not_found", status: 404 };
    if (agent.type === "sub_agent") return { ok: false, error: "agent_has_no_own_memory", status: 400 };
    return { ok: true, place: { ...base, agentId: agent.id } };
  }
  if (scope === "session") {
    if (typeof input.scopeId !== "string" || !input.scopeId) return { ok: false, error: "invalid_scope", status: 400 };
    return { ok: true, place: { ...base, scopeId: input.scopeId } };
  }
  return { ok: true, place: base };
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

    const agentId = c.req.query("agentId");
    if (agentId) query = query.where("agentId", "=", agentId);

    const scopeId = c.req.query("scopeId");
    if (scopeId !== undefined) query = query.where("scopeId", "=", scopeId);

    const scopeFilter = c.req.query("scope");
    if (scopeFilter) {
      const parsed = parseScope(scopeFilter);
      if (parsed !== "invalid") query = query.where("scope", "=", parsed);
    }

    const q = c.req.query("q");
    if (q) query = query.where((eb) => eb.or([eb("title", "ilike", `%${q}%`), eb("content", "ilike", `%${q}%`)]));

    const rows = await query.orderBy("createdAt", "desc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    const memoryScope = parseScope(body?.scope);
    if (memoryScope === "invalid") return c.json({ error: "invalid_scope" }, 400);
    const title = normalizeTitle(body?.title);
    if (!title.ok) return c.json({ error: "invalid_title", message: title.error }, 400);
    const content = normalizeContent(body?.content);
    if (!content.ok) return c.json({ error: "invalid_content", message: content.error }, 400);

    const placed = await resolvePlace(s.organizationId, memoryScope, body ?? {});
    if (!placed.ok) return c.json({ error: placed.error }, placed.status);
    if (await titleTaken(placed.place, title.title)) return c.json({ error: "title_taken" }, 409);
    const space = await validateSpaceId(s.organizationId, body?.spaceId);
    if (!space.ok) return c.json({ error: space.error }, 400);

    const now = new Date();
    const row = await db
      .insertInto("memory")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        codeDirectoryId: placed.place.codeDirectoryId,
        agentId: placed.place.agentId,
        spaceId: space.spaceId,
        scopeId: placed.place.scopeId,
        scope: memoryScope,
        title: title.title,
        content: content.content,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  // What a session's agent can see: organization + directory + its own memory (sub_agents inherit their parent's).
  .get("/applicable", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const sessionId = c.req.query("sessionId");
    if (!sessionId) return c.json({ error: "session_required" }, 400);
    return c.json(await listSessionMemories(s.organizationId, sessionId));
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

    const existing = await db.selectFrom("memory").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!existing) return c.json({ error: "memory_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ title: string; content: string; scope: MemoryScope; codeDirectoryId: string | null; agentId: string | null; scopeId: string | null; spaceId: string | null }> = {};

    if (body?.spaceId !== undefined) {
      const space = await validateSpaceId(s.organizationId, body.spaceId);
      if (!space.ok) return c.json({ error: space.error }, 400);
      patch.spaceId = space.spaceId;
    }
    if (body?.title !== undefined) {
      const title = normalizeTitle(body.title);
      if (!title.ok) return c.json({ error: "invalid_title", message: title.error }, 400);
      patch.title = title.title;
    }
    if (body?.content !== undefined) {
      const content = normalizeContent(body.content);
      if (!content.ok) return c.json({ error: "invalid_content", message: content.error }, 400);
      patch.content = content.content;
    }

    // Moving between levels (or re-pointing the owner) revalidates the place.
    const touchesPlace = ["scope", "codeDirectoryId", "agentId", "scopeId"].some((k) => body?.[k] !== undefined);
    let place: MemoryPlace = existing;
    if (touchesPlace) {
      const nextScope = body?.scope !== undefined ? parseScope(body.scope) : existing.scope;
      if (nextScope === "invalid") return c.json({ error: "invalid_scope" }, 400);
      const placed = await resolvePlace(s.organizationId, nextScope, {
        codeDirectoryId: body?.codeDirectoryId !== undefined ? body.codeDirectoryId : existing.codeDirectoryId,
        agentId: body?.agentId !== undefined ? body.agentId : existing.agentId,
        scopeId: body?.scopeId !== undefined ? body.scopeId : existing.scopeId,
      });
      if (!placed.ok) return c.json({ error: placed.error }, placed.status);
      place = placed.place;
      patch.scope = nextScope;
      patch.codeDirectoryId = place.codeDirectoryId;
      patch.agentId = place.agentId;
      patch.scopeId = place.scopeId;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    if ((patch.title !== undefined || touchesPlace) && (await titleTaken(place, patch.title ?? existing.title, existing.id))) {
      return c.json({ error: "title_taken" }, 409);
    }

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
