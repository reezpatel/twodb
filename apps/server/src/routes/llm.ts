import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getProvider, LLM_PROVIDERS } from "../lib/llm-providers";
import { refreshConnectionModels } from "../lib/refresh-models";
import type { LlmConnectionTable } from "../plugins/db";
import { runAgentRound, type AgentMessage } from "../lib/agent";
import { ensureFreshTokens } from "../lib/token-refresh";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface QuotaSnapshot {
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  resetAt: Date | null;
}

type QuotaCollector = (connection: LlmConnectionTable) => Promise<QuotaSnapshot[]>;

async function fetchJson(url: string, headers: Record<string, string>, timeoutMs = 10_000): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) throw new Error(`provider returned ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("provider returned invalid JSON");
  }
}

const finite = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Claude Code: oauth usage endpoint with 5h + weekly percent windows. */
async function collectClaudeCode(connection: LlmConnectionTable): Promise<QuotaSnapshot[]> {
  const config = await ensureFreshTokens(connection);
  const token = config.access_token;
  if (!token) throw new Error("missing OAuth access token");

  const json = await fetchJson("https://api.anthropic.com/api/oauth/usage", {
    authorization: `Bearer ${token}`,
    "anthropic-beta": "oauth-2025-04-20",
  });

  const roots = [json, asRecord(json)?.data, asRecord(json)?.usage].filter(asRecord).map((r) => r as Record<string, unknown>);
  const snap: QuotaSnapshot[] = [];
  for (const root of roots) {
    for (const [key, type] of [
      ["five_hour", "5h"],
      ["seven_day", "weekly"],
    ] as const) {
      const win = asRecord(root[key] ?? root[key === "five_hour" ? "fiveHour" : "sevenDay"]);
      if (!win) continue;
      const used = finite(win.usedPercent ?? win.used_percent);
      if (used === undefined) continue;
      const resetRaw = win.resetIso ?? win.resets_at ?? win.ends_at;
      const resetMs = finite(win.resetAt ?? win.reset_at);
      snap.push({
        quotaType: type,
        groupName: "default",
        unit: "percent",
        quotaTotal: 100,
        quotaUsed: Math.max(0, Math.min(100, used)),
        resetAt: typeof resetRaw === "string" && resetRaw ? new Date(resetRaw) : resetMs && resetMs > 0 ? new Date(resetMs) : null,
      });
    }
  }
  return snap;
}

/** z.ai: monitor API with percentage windows keyed by limit type/unit. */
async function collectZai(connection: LlmConnectionTable): Promise<QuotaSnapshot[]> {
  const config = connection.config as Record<string, string>;
  const apiKey = config.api_key ?? config.apiKey;
  if (!apiKey) throw new Error("missing API key");

  const json = await fetchJson("https://api.z.ai/api/monitor/usage/quota/limit", {
    authorization: apiKey,
    "user-agent": "twodb/1.0",
    "content-type": "application/json",
  });

  const limits = asRecord(asRecord(json)?.data)?.limits;
  if (!Array.isArray(limits)) throw new Error("invalid z.ai quota response");

  const snap: QuotaSnapshot[] = [];
  for (const raw of limits) {
    const limit = asRecord(raw);
    if (!limit) continue;
    const percentage = finite(limit.percentage);
    if (percentage === undefined) continue;
    const type = typeof limit.type === "string" ? limit.type : "";
    const unitCode = finite(limit.unit);
    let quotaType: string | null = null;
    if (type === "TOKENS_LIMIT") {
      if (unitCode === 3) quotaType = "5h";
      else if (unitCode === 4) quotaType = "daily";
      else if (unitCode === 6) quotaType = "weekly";
    } else if (type === "TIME_LIMIT") {
      quotaType = "monthly";
    }
    if (!quotaType) continue;
    const resetMs = finite(limit.nextResetTime);
    snap.push({
      quotaType,
      groupName: "default",
      unit: "percent",
      quotaTotal: 100,
      quotaUsed: Math.max(0, Math.min(100, percentage)),
      resetAt: resetMs && resetMs > 0 ? new Date(resetMs) : null,
    });
  }
  return snap;
}

/** Kimi for Coding: usages endpoint with used/limit token windows. */
async function collectKimi(connection: LlmConnectionTable): Promise<QuotaSnapshot[]> {
  const config = connection.config as Record<string, string>;
  const apiKey = config.api_key ?? config.apiKey ?? config.access_token;
  if (!apiKey) throw new Error("missing API key");

  const json = await fetchJson("https://api.kimi.com/coding/v1/usages", {
    authorization: `Bearer ${apiKey}`,
    "user-agent": "twodb/1.0",
  });

  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  const usage = asRecord(data?.usage);
  const limits = data?.limits;

  const parseReset = (rec: Record<string, unknown>): Date | null => {
    for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) {
        const t = Date.parse(v);
        if (Number.isFinite(t)) return new Date(t);
      }
    }
    for (const key of ["reset_in", "resetIn", "ttl"]) {
      const seconds = finite(rec[key]);
      if (seconds !== undefined && seconds > 0) return new Date(Date.now() + seconds * 1000);
    }
    const win = asRecord(rec.window);
    const seconds = win ? finite(win.duration) : undefined;
    if (seconds !== undefined && seconds > 0) return new Date(Date.now() + seconds * 1000);
    return null;
  };

  const typeFromLabel = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes("5h") || l.includes("5 h")) return "5h";
    if (l.includes("week") || l.includes("7d")) return "weekly";
    if (l.includes("month") || l.includes("30d")) return "monthly";
    return "daily";
  };

  const windows: { label: string; used: number; limit: number; resetAt: Date | null }[] = [];
  const pushWindow = (rec: Record<string, unknown>, fallbackLabel: string) => {
    const limit = finite(rec.limit);
    let used = finite(rec.used);
    if (used === undefined) {
      const remaining = finite(rec.remaining);
      if (remaining !== undefined && limit !== undefined) used = limit - remaining;
    }
    if (used === undefined && limit === undefined) return;
    const label = (typeof rec.name === "string" && rec.name.trim() ? rec.name : typeof rec.title === "string" && rec.title.trim() ? rec.title : null) ?? fallbackLabel;
    windows.push({ label, used: used ?? 0, limit: limit ?? 0, resetAt: parseReset(rec) });
  };

  if (usage) pushWindow(usage, "Weekly limit");
  if (Array.isArray(limits)) {
    limits.forEach((raw, index) => {
      const item = asRecord(raw);
      if (!item) return;
      const detail = asRecord(item.detail) ?? item;
      const window = asRecord(item.window) ?? {};
      let label = "";
      for (const key of ["name", "title", "scope"]) {
        const v = item[key] ?? detail[key];
        if (typeof v === "string" && v.trim()) {
          label = v.trim();
          break;
        }
      }
      if (!label) {
        const duration = finite(window.duration ?? item.duration ?? detail.duration);
        const timeUnit = String(window.timeUnit ?? item.timeUnit ?? detail.timeUnit ?? "");
        if (duration !== undefined && duration > 0) {
          if (timeUnit.includes("MINUTE")) label = duration >= 60 && duration % 60 === 0 ? `${duration / 60}h limit` : `${duration}m limit`;
          else if (timeUnit.includes("HOUR")) label = `${duration}h limit`;
          else if (timeUnit.includes("DAY")) label = `${duration}d limit`;
          else label = `${duration}s limit`;
        }
      }
      pushWindow(detail, label || `Limit #${index + 1}`);
    });
  }

  return windows.map((w) => ({
    quotaType: typeFromLabel(w.label),
    groupName: "default",
    unit: "Tk",
    quotaTotal: w.limit > 0 ? w.limit : null,
    quotaUsed: w.used,
    resetAt: w.resetAt,
  }));
}

const QUOTA_COLLECTORS: Record<string, QuotaCollector> = {
  "claude-code": collectClaudeCode,
  zai: collectZai,
  kimi: collectKimi,
};

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

  /** Provider quota collection — one collector per subscription-backed provider. */
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

    const collector = QUOTA_COLLECTORS[connection.provider];
    if (!collector) {
      return c.json({ error: "quota_refresh_not_supported", provider: connection.provider }, 400);
    }

    let snapshots: QuotaSnapshot[];
    try {
      snapshots = await collector(connection);
    } catch (e) {
      return c.json({ error: "quota_fetch_failed", detail: (e as Error).message.slice(0, 300) }, 502);
    }
    if (snapshots.length === 0) return c.json({ error: "quota_parse_failed" }, 502);

    const now = new Date();
    for (const snap of snapshots) {
      const existing = await db
        .selectFrom("llm_quota")
        .select("id")
        .where("connectionId", "=", connection.id)
        .where("quotaType", "=", snap.quotaType)
        .where("groupName", "=", snap.groupName)
        .executeTakeFirst();
      if (existing) {
        await db.updateTable("llm_quota").set({ ...snap, capturedAt: now }).where("id", "=", existing.id).execute();
      } else {
        await db
          .insertInto("llm_quota")
          .values({ id: crypto.randomUUID(), organizationId: s.organizationId, connectionId: connection.id, ...snap, capturedAt: now })
          .execute();
      }
    }

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
