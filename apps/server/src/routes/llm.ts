import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getProvider, LLM_PROVIDERS } from "../lib/llm-providers";
import { refreshConnectionModels } from "../lib/refresh-models";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const llmRoutes = new Hono()
  .get("/providers", (c) => c.json(LLM_PROVIDERS))

  .get("/connections", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const rows = await db.selectFrom("llm_connection").selectAll().where("organizationId", "=", s.organizationId).orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .post("/connections", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const provider = typeof body?.provider === "string" ? body.provider : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const config = isRecord(body?.config) ? body.config : {};

    if (!getProvider(provider)) {
      return c.json({ error: "unknown_provider" }, 400);
    }
    if (!name) return c.json({ error: "invalid_name" }, 400);

    const now = new Date();
    const row = await db
      .insertInto("llm_connection")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        provider,
        name,
        config,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Seed the model list right away (static fallback if the provider API fails).
    try {
      await refreshConnectionModels(row);
    } catch {
      // model list stays empty; user can refresh manually
    }
    return c.json(row, 201);
  })

  .patch("/connections/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{
      name: string;
      config: Record<string, unknown>;
      enabled: boolean;
    }> = {};

    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return c.json({ error: "invalid_name" }, 400);
      }
      patch.name = body.name.trim();
    }
    if (body?.config !== undefined) {
      if (!isRecord(body.config)) return c.json({ error: "invalid_config" }, 400);
      patch.config = body.config;
    }
    if (body?.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return c.json({ error: "invalid_enabled" }, 400);
      }
      patch.enabled = body.enabled;
    }
    if (Object.keys(patch).length === 0) {
      return c.json({ error: "empty_update" }, 400);
    }

    const row = await db
      .updateTable("llm_connection")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returningAll()
      .executeTakeFirst();
    if (!row) return c.json({ error: "connection_not_found" }, 404);
    return c.json(row);
  })

  .delete("/connections/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const row = await db
      .deleteFrom("llm_connection")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .returning("id")
      .executeTakeFirst();
    if (!row) return c.json({ error: "connection_not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/connections/:id/usage", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);

    const totals = await db
      .selectFrom("llm_usage_event")
      .select((eb) => [
        eb.fn.countAll().as("requests"),
        eb.fn.sum("inputTokens").as("inputTokens"),
        eb.fn.sum("outputTokens").as("outputTokens"),
        eb.fn.max("createdAt").as("lastUsedAt"),
      ])
      .where("connectionId", "=", connection.id)
      .executeTakeFirst();

    return c.json({
      requests: Number(totals?.requests ?? 0),
      inputTokens: Number(totals?.inputTokens ?? 0),
      outputTokens: Number(totals?.outputTokens ?? 0),
      lastUsedAt: totals?.lastUsedAt ?? null,
    });
  })

  .get("/connections/:id/models", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const rows = await db
      .selectFrom("llm_model")
      .selectAll()
      .where("connectionId", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .orderBy("modelId", "asc")
      .execute();
    return c.json(rows);
  })

  .post("/connections/:id/refresh-models", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);

    const result = await refreshConnectionModels(connection);
    return c.json(result);
  })

  .post("/refresh-models", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connections = await db.selectFrom("llm_connection").selectAll().where("organizationId", "=", s.organizationId).execute();

    const results = [];
    for (const connection of connections) {
      try {
        const result = await refreshConnectionModels(connection);
        results.push({ id: connection.id, name: connection.name, ...result });
      } catch (e) {
        results.push({
          id: connection.id,
          name: connection.name,
          count: 0,
          error: (e as Error).message,
        });
      }
    }
    return c.json(results);
  });
