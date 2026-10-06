import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { resolveScope } from "../lib/code-directory";
import { parseTags, syncLlmTags } from "../lib/llm-tags";
import { evictMcpClient, listMcpServerTools, parseMcpServersJson } from "../lib/mcp";
import { DEFAULT_SKILL_TAG } from "../lib/skills";
import type { McpServerTable } from "../plugins/db";
import type { Selectable } from "kysely";

const TRANSPORTS = new Set(["auto", "http", "sse"]);

function parseHeaders(value: unknown): Record<string, string> | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "invalid";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string") return "invalid";
    out[k] = v;
  }
  return out;
}

function validUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Headers may carry <ENV_NAME> placeholders — the UI should not silently leak their resolved values. */
function publicRow(row: Selectable<McpServerTable>) {
  return row;
}

export const mcpRoutes = new Hono()
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    let query = db.selectFrom("mcp_server").selectAll().where("organizationId", "=", s.organizationId);
    const codeDirectoryId = c.req.query("codeDirectoryId");
    if (codeDirectoryId) query = query.where((eb) => eb.or([eb("codeDirectoryId", "is", null), eb("codeDirectoryId", "=", codeDirectoryId)]));
    const rows = await query.orderBy("name", "asc").execute();
    return c.json(rows.map(publicRow));
  })

  .post("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json().catch(() => null);
    if (body?.id !== undefined && (typeof body.id !== "string" || !body.id.trim() || body.id.length > 64)) return c.json({ error: "invalid_id" }, 400);
    if (typeof body?.name !== "string" || !/^[\w][\w-]*$/.test(body.name.trim())) return c.json({ error: "invalid_name" }, 400);
    const url = validUrl(body?.url);
    if (!url) return c.json({ error: "invalid_url" }, 400);
    if (body?.transport !== undefined && (typeof body.transport !== "string" || !TRANSPORTS.has(body.transport))) return c.json({ error: "invalid_transport" }, 400);
    const headers = parseHeaders(body?.headers);
    if (headers === "invalid") return c.json({ error: "invalid_headers" }, 400);
    const tags = parseTags(body?.tags);
    if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
    // Empty tags would match no session — default to the universal tag, like import.
    const tagList = tags?.length ? tags : [DEFAULT_SKILL_TAG];

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    try {
      const row = await db
        .insertInto("mcp_server")
        .values({
          id: typeof body?.id === "string" && body.id.trim() ? body.id.trim() : crypto.randomUUID(),
          organizationId: s.organizationId,
          codeDirectoryId: scope.codeDirectoryId,
          name: body.name.trim(),
          url,
          transport: typeof body?.transport === "string" ? body.transport : "auto",
          headers: headers ?? {},
          enabled: body?.enabled === false ? false : true,
          tags: tagList,
          createdAt: now,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await syncLlmTags(s.organizationId, row.tags);
      return c.json(row, 201);
    } catch (e) {
      if ((e as Error).message.includes("mcp_server_scope_name_unique")) return c.json({ error: "name_taken" }, 409);
      throw e;
    }
  })

  .get("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const row = await db.selectFrom("mcp_server").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "mcp_server_not_found" }, 404);
    return c.json(row);
  })

  .patch("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);

    const existing = await db
      .selectFrom("mcp_server")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "mcp_server_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; url: string; transport: string; headers: Record<string, string>; enabled: boolean; tags: string[] }> = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !/^[\w][\w-]*$/.test(body.name.trim())) return c.json({ error: "invalid_name" }, 400);
      patch.name = body.name.trim();
    }
    if (body?.url !== undefined) {
      const url = validUrl(body.url);
      if (!url) return c.json({ error: "invalid_url" }, 400);
      patch.url = url;
    }
    if (body?.transport !== undefined) {
      if (typeof body.transport !== "string" || !TRANSPORTS.has(body.transport)) return c.json({ error: "invalid_transport" }, 400);
      patch.transport = body.transport;
    }
    if (body?.headers !== undefined) {
      const headers = parseHeaders(body.headers);
      if (headers === "invalid") return c.json({ error: "invalid_headers" }, 400);
      patch.headers = headers ?? {};
    }
    if (body?.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") return c.json({ error: "invalid_enabled" }, 400);
      patch.enabled = body.enabled;
    }
    if (body?.tags !== undefined) {
      const tags = parseTags(body.tags);
      if (tags === "invalid") return c.json({ error: "invalid_tags" }, 400);
      // Empty tags would match no session — default to the universal tag.
      patch.tags = tags?.length ? tags : [DEFAULT_SKILL_TAG];
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    try {
      const row = await db
        .updateTable("mcp_server")
        .set({ ...patch, updatedAt: new Date() })
        .where("id", "=", existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      evictMcpClient(row.id);
      await syncLlmTags(s.organizationId, row.tags);
      return c.json(row);
    } catch (e) {
      if ((e as Error).message.includes("mcp_server_scope_name_unique")) return c.json({ error: "name_taken" }, 409);
      throw e;
    }
  })

  .delete("/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const existing = await db
      .selectFrom("mcp_server")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!existing) return c.json({ error: "mcp_server_not_found" }, 404);
    await db.deleteFrom("mcp_server").where("id", "=", existing.id).execute();
    evictMcpClient(existing.id);
    return c.json({ ok: true });
  })

  /** Connect + list tools — the UI's test button and the tool-count badge. */
  .post("/:id/tools", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const row = await db.selectFrom("mcp_server").selectAll().where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "mcp_server_not_found" }, 404);
    try {
      const started = Date.now();
      const tools = await listMcpServerTools(row);
      return c.json({ ok: true, ms: Date.now() - started, tools: tools.map((t) => ({ name: t.remoteName, agentName: t.tool.name, description: t.tool.description })) });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 200);
    }
  })

  /** mcpServers JSON preview: parses without writing so the sheet can show what would land. */
  .post("/import/preview", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    const parsed = parseMcpServersJson(body?.json);
    if ("error" in parsed) return c.json(parsed, 400);
    return c.json(parsed);
  })

  /** Bulk insert of parsed drafts — one mcpServers paste becomes many rows. */
  .post("/import", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    const parsed = parseMcpServersJson(body?.json);
    if ("error" in parsed) return c.json(parsed, 400);

    const scope = await resolveScope(db, s.organizationId, body?.codeDirectoryId);
    if (!scope.ok) return c.json({ error: scope.error }, scope.error === "directory_not_found" ? 404 : 400);

    const now = new Date();
    const created: Selectable<McpServerTable>[] = [];
    const conflicts: string[] = [];
    const existing = await db.selectFrom("mcp_server").select(["name", "codeDirectoryId"]).where("organizationId", "=", s.organizationId).execute();
    const taken = new Set(existing.filter((r) => r.codeDirectoryId === scope.codeDirectoryId).map((r) => r.name));

    for (const draft of parsed.drafts) {
      if (taken.has(draft.name)) {
        conflicts.push(draft.name);
        continue;
      }
      const row = await db
        .insertInto("mcp_server")
        .values({
          id: crypto.randomUUID(),
          organizationId: s.organizationId,
          codeDirectoryId: scope.codeDirectoryId,
          name: draft.name,
          url: draft.url,
          transport: draft.transport,
          headers: draft.headers,
          enabled: true,
          tags: ["default"],
          createdAt: now,
          updatedAt: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      created.push(row);
      taken.add(draft.name);
    }
    return c.json({ created, conflicts, skipped: parsed.skipped }, 201);
  });
