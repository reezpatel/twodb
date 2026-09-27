import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getProvider, LLM_PROVIDERS } from "../lib/llm-providers";
import { refreshConnectionModels } from "../lib/refresh-models";
import { runAgentRound, type AgentMessage } from "../lib/agent";
import { ensureFreshTokens } from "../lib/token-refresh";

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

  .get("/connections/:id/quotas", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);

    const rows = await db
      .selectFrom("llm_quota")
      .selectAll()
      .where("connectionId", "=", connection.id)
      .orderBy("quotaType", "asc")
      .execute();
    return c.json(rows);
  })

  /** Upsert a quota snapshot (manual or collector-fed). */
  .post("/connections/:id/quotas", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const quotaType = typeof body?.quotaType === "string" ? body.quotaType.trim() : "";
    if (!quotaType) return c.json({ error: "invalid_quota_type" }, 400);
    const groupName = typeof body?.groupName === "string" && body.groupName.trim() ? body.groupName.trim() : "default";
    const unit = typeof body?.unit === "string" && body.unit.trim() ? body.unit.trim() : "tokens";
    if (typeof body?.quotaUsed !== "number" || !Number.isFinite(body.quotaUsed) || body.quotaUsed < 0) {
      return c.json({ error: "invalid_quota_used" }, 400);
    }
    let quotaTotal: number | null = null;
    if (body?.quotaTotal !== undefined && body?.quotaTotal !== null) {
      if (typeof body.quotaTotal !== "number" || !Number.isFinite(body.quotaTotal) || body.quotaTotal < 0) {
        return c.json({ error: "invalid_quota_total" }, 400);
      }
      quotaTotal = body.quotaTotal;
    }
    let resetAt: Date | null = null;
    if (typeof body?.resetAt === "string" && body.resetAt) {
      const parsed = new Date(body.resetAt);
      if (Number.isNaN(parsed.getTime())) return c.json({ error: "invalid_reset_at" }, 400);
      resetAt = parsed;
    }

    const existing = await db
      .selectFrom("llm_quota")
      .select("id")
      .where("connectionId", "=", connection.id)
      .where("quotaType", "=", quotaType)
      .where("groupName", "=", groupName)
      .executeTakeFirst();

    const now = new Date();
    if (existing) {
      const row = await db
        .updateTable("llm_quota")
        .set({ unit, quotaTotal, quotaUsed: body.quotaUsed, capturedAt: now, resetAt })
        .where("id", "=", existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return c.json(row);
    }

    const row = await db
      .insertInto("llm_quota")
      .values({ id: crypto.randomUUID(), organizationId: s.organizationId, connectionId: connection.id, quotaType, groupName, unit, quotaTotal, quotaUsed: body.quotaUsed, capturedAt: now, resetAt })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  /** Provider quota collection — currently Claude Code (5h + weekly windows). */
  .post("/connections/:id/refresh-quotas", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);
    if (connection.provider !== "claude-code") {
      return c.json({ error: "quota_refresh_not_supported", provider: connection.provider }, 400);
    }

    const config = await ensureFreshTokens(connection);
    const token = config.access_token;
    if (!token) return c.json({ error: "missing_access_token" }, 400);

    let json: unknown;
    try {
      const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: { authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20", accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) return c.json({ error: `usage_error_${res.status}`, detail: text.slice(0, 200) }, 502);
      json = JSON.parse(text);
    } catch (e) {
      return c.json({ error: "usage_fetch_failed", detail: (e as Error).message }, 502);
    }

    const roots = [json, (json as { data?: unknown })?.data, (json as { usage?: unknown })?.usage].filter((r) => typeof r === "object" && r !== null);
    const asWindow = (v: unknown): { usedPercent: number; resetIso?: string } | null => {
      if (typeof v !== "object" || v === null) return null;
      const used = (v as { usedPercent?: unknown }).usedPercent ?? (v as { used_percent?: unknown }).used_percent;
      if (typeof used !== "number") return null;
      const reset = (v as { resetIso?: unknown }).resetIso ?? (v as { resets_at?: unknown }).resets_at ?? (v as { ends_at?: unknown }).ends_at;
      return { usedPercent: used, resetIso: typeof reset === "string" ? reset : undefined };
    };

    let fiveHour: { usedPercent: number; resetIso?: string } | null = null;
    let sevenDay: { usedPercent: number; resetIso?: string } | null = null;
    for (const root of roots as Record<string, unknown>[]) {
      fiveHour = fiveHour ?? asWindow(root.five_hour ?? root.fiveHour);
      sevenDay = sevenDay ?? asWindow(root.seven_day ?? root.sevenDay);
    }
    if (!fiveHour && !sevenDay) return c.json({ error: "usage_parse_failed" }, 502);

    const now = new Date();
    const upsert = async (quotaType: string, window: { usedPercent: number; resetIso?: string }) => {
      const existing = await db
        .selectFrom("llm_quota")
        .select("id")
        .where("connectionId", "=", connection.id)
        .where("quotaType", "=", quotaType)
        .where("groupName", "=", "default")
        .executeTakeFirst();
      const values = {
        unit: "percent",
        quotaTotal: 100,
        quotaUsed: window.usedPercent,
        capturedAt: now,
        resetAt: window.resetIso ? new Date(window.resetIso) : null,
      };
      if (existing) {
        await db.updateTable("llm_quota").set(values).where("id", "=", existing.id).execute();
      } else {
        await db
          .insertInto("llm_quota")
          .values({ id: crypto.randomUUID(), organizationId: s.organizationId, connectionId: connection.id, quotaType, groupName: "default", ...values })
          .execute();
      }
    };
    if (fiveHour) await upsert("5h", fiveHour);
    if (sevenDay) await upsert("weekly", sevenDay);

    const rows = await db.selectFrom("llm_quota").selectAll().where("connectionId", "=", connection.id).orderBy("quotaType", "asc").execute();
    return c.json(rows);
  })

  /** One tiny round-trip per connection — proves credentials + wire + model. */
  .post("/connections/:id/test", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const connection = await db
      .selectFrom("llm_connection")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!connection) return c.json({ error: "connection_not_found" }, 404);

    const stored = await db
      .selectFrom("llm_model")
      .select("modelId")
      .where("connectionId", "=", connection.id)
      .orderBy("createdAt", "asc")
      .limit(1)
      .executeTakeFirst();
    const provider = getProvider(connection.provider);
    const model = stored?.modelId ?? provider?.models[0];
    if (!model) return c.json({ error: "no_model_available" }, 400);

    const started = Date.now();
    try {
      const messages: AgentMessage[] = [{ role: "user", content: "Reply with exactly: OK", meta: null }];
      const result = await runAgentRound(connection, model, messages, []);
      return c.json({
        ok: true,
        model,
        ms: Date.now() - started,
        reply: (result.content ?? "").trim().slice(0, 200),
        usage: result.usage,
      });
    } catch (e) {
      return c.json({ ok: false, model, ms: Date.now() - started, error: (e as Error).message.slice(0, 300) });
    }
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
