import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";
import { parseTags, syncLlmTags } from "../lib/llm-tags";
import type { AgentTable } from "../plugins/db";

export type AgentType = AgentTable["type"];
export const AGENT_TYPES: AgentType[] = ["sub_agent", "persona", "collaborator", "sentinel"];

const parseType = (v: unknown): AgentType | null => (typeof v === "string" && (AGENT_TYPES as string[]).includes(v) ? (v as AgentType) : null);
const parseTools = (v: unknown): string[] | "invalid" => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || !v.every((t) => typeof t === "string" && t.trim())) return "invalid";
  const tools = [...new Set((v as string[]).map((t) => t.trim()))].filter(Boolean);
  return tools.includes("all") ? ["all"] : tools;
};

/** Only one sentinel per organization. */
async function sentinelExists(organizationId: string, excludeId?: string) {
  let query = db.selectFrom("agent").select("id").where("organizationId", "=", organizationId).where("type", "=", "sentinel");
  if (excludeId) query = query.where("id", "<>", excludeId);
  return (await query.executeTakeFirst()) !== undefined;
}

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
    const tags = parseTags(body?.tags);
    if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
    const type = body?.type === undefined ? "sub_agent" : parseType(body.type);
    if (!type) return c.json({ error: "invalid_type" }, 400);
    const tools = parseTools(body?.tools);
    if (tools === "invalid") return c.json({ error: "invalid_tools" }, 400);
    if (type === "sentinel" && (await sentinelExists(s.organizationId))) return c.json({ error: "sentinel_exists" }, 409);

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
        tags: tags ?? [],
        type,
        tools,
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
    const patch: Partial<{ provider: string; model: string; description: string | null; instruction: string; tags: string[]; type: AgentType; tools: string[] }> = {};
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
    if (body?.tags !== undefined) {
      const tags = parseTags(body.tags);
      if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
      patch.tags = tags ?? [];
    }
    let sentinelCheckId: string | undefined;
    if (body?.type !== undefined) {
      const type = parseType(body.type);
      if (!type) return c.json({ error: "invalid_type" }, 400);
      patch.type = type;
      sentinelCheckId = existing.id;
    }
    if (body?.tools !== undefined) {
      const tools = parseTools(body.tools);
      if (tools === "invalid") return c.json({ error: "invalid_tools" }, 400);
      patch.tools = tools;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);
    if (patch.type === "sentinel" && (await sentinelExists(s.organizationId, sentinelCheckId))) return c.json({ error: "sentinel_exists" }, 409);

    const row = await db
      .updateTable("agent")
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

    const row = await db.deleteFrom("agent").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "agent_not_found" }, 404);
    return c.json({ ok: true });
  });
