import type { ConnectionsRepo, ConnectionConfig } from "../db/repository.js";
import type { LlmConnectionRow } from "../db/schema.js";
import { getProviderSpec, type ProviderSpec } from "../providers/catalog.js";
import { modelsDevCatalog, modelsDevLookup, type ModelsDevModel } from "./models-dev.js";
import { ensureFreshTokens } from "./token-refresh.js";
import type { Kysely } from "kysely";
import type { TwoRouteDb } from "../db/schema.js";

// Model refresh + quota collection — ported from the legacy app's
// lib/refresh-models.ts and routes/llm.ts collectors, adapted to the typed
// connection shape (columns + encrypted config blob instead of a config column).

interface FetchedModel {
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
  thinking: boolean;
  input: ("text" | "image" | "video")[];
  thinkingLevel: string[];
  temperature: boolean;
  limitContext: number | null;
  limitInput: number | null;
  limitOutput: number | null;
  costInput: number | null;
  costOutput: number | null;
  costCacheRead: number | null;
  output: string[];
}

const MODALITIES = new Set(["text", "image", "video"]);

function enrich(base: FetchedModel, meta: ModelsDevModel | undefined): FetchedModel {
  if (!meta) return base;
  const reasoning = meta.reasoning;
  const thinking = reasoning === true || (meta.reasoning_options?.some((o) => (o.values?.length ?? 0) > 0) ?? false);
  const thinkingLevel = (meta.reasoning_options ?? []).flatMap((o) => o.values ?? []).filter((v) => typeof v === "string");
  return {
    ...base,
    displayName: base.displayName ?? (typeof meta.name === "string" && meta.name ? meta.name : null),
    contextWindow: base.contextWindow ?? meta.limit?.context ?? null,
    thinking: base.thinking || thinking,
    input: base.input.length > 0 ? base.input : (meta.modalities?.input ?? []).filter((m): m is "text" | "image" | "video" => MODALITIES.has(m)),
    thinkingLevel: thinkingLevel.length > 0 ? thinkingLevel : base.thinkingLevel,
    temperature: meta.temperature === true,
    limitContext: base.limitContext ?? meta.limit?.context ?? null,
    limitInput: base.limitInput ?? meta.limit?.input ?? null,
    limitOutput: base.limitOutput ?? meta.limit?.output ?? null,
    costInput: base.costInput ?? meta.cost?.input ?? null,
    costOutput: base.costOutput ?? meta.cost?.output ?? null,
    costCacheRead: base.costCacheRead ?? meta.cost?.cache_read ?? null,
    output: base.output.length > 0 ? base.output : (meta.modalities?.output ?? []),
  };
}

/** Auth headers per the catalog's auth style — legacy's providerAuthHeaders. */
export function providerAuthHeaders(spec: ProviderSpec, config: ConnectionConfig, apiKey: string): Record<string, string> {
  if (spec.auth === "x-api-key") {
    return apiKey ? { "x-api-key": apiKey } : {};
  }
  if (spec.auth === "claude-oauth") {
    const token = config[spec.authKey ?? "accessToken"];
    return token ? { authorization: `Bearer ${token}` } : {};
  }
  // bearer (incl. codex, whose access token rides the same header)
  const credential = config[spec.authKey ?? ""] ?? apiKey;
  return credential ? { authorization: `Bearer ${credential}` } : {};
}

function providerBaseUrl(spec: ProviderSpec, config: ConnectionConfig, baseUrl: string): string {
  const url = (config.base_url || baseUrl || spec.defaultBaseUrl || "").replace(/\/$/, "");
  if (!url) throw new Error(`invalid base_url for provider "${spec.id}"`);
  return url;
}

async function fetchProviderModels(connection: LlmConnectionRow & { configParsed: ConnectionConfig }): Promise<FetchedModel[]> {
  const spec = getProviderSpec(connection.provider);
  if (!spec?.api || spec.api === "responses") throw new Error("provider does not support model listing");

  const baseUrl = providerBaseUrl(spec, connection.configParsed, connection.base_url);
  const url = spec.api === "openai" ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

  const headers = providerAuthHeaders(spec, connection.configParsed, connection.api_key);
  if (spec.api === "anthropic") headers["anthropic-version"] = "2023-06-01";

  const res = await fetch(url, { method: "GET", headers });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  let json: {
    data?: {
      id?: unknown;
      display_name?: unknown;
      name?: unknown;
      context_window?: unknown;
      context_length?: unknown;
      per_request_limits?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null;
      pricing?: { prompt?: unknown; completion?: unknown; input_cache_read?: unknown };
      architecture?: { input_modalities?: unknown; output_modalities?: unknown };
    }[];
  };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("provider returned invalid JSON");
  }

  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  // providers quote per-token prices ("0.0000016"); our columns are per-million
  const perM = (v: unknown): number | null => {
    const n = num(v);
    // <= 0 is a provider sentinel (-1 = "dynamic pricing", 0 = free) — treat as unknown
    if (n === null || n <= 0) return null;
    return Number((n * 1_000_000).toFixed(6));
  };
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

  const data = Array.isArray(json.data) ? json.data : [];
  return data
    .filter((m) => typeof m.id === "string" && m.id)
    .map((m) => ({
      modelId: m.id as string,
      displayName: typeof m.display_name === "string" ? m.display_name : typeof m.name === "string" ? m.name : null,
      contextWindow: num(m.context_window) ?? num(m.context_length),
      thinking: false,
      input: strArr(m.architecture?.input_modalities).filter((x): x is "text" | "image" | "video" => MODALITIES.has(x)),
      thinkingLevel: [] as string[],
      temperature: false,
      limitContext: num(m.context_length),
      limitInput: num(m.per_request_limits?.prompt_tokens),
      limitOutput: num(m.per_request_limits?.completion_tokens),
      costInput: perM(m.pricing?.prompt),
      costOutput: perM(m.pricing?.completion),
      costCacheRead: perM(m.pricing?.input_cache_read),
      output: strArr(m.architecture?.output_modalities),
    }));
}

/**
 * Refreshes a connection's model list from the provider, enriched with
 * models.dev metadata. Falls back to the provider's static list so dropdowns
 * are never empty. Cached into llm_model.
 */
export async function refreshConnectionModels(
  connection: LlmConnectionRow & { configParsed: ConnectionConfig },
  connections: ConnectionsRepo,
): Promise<{ count: number; warning?: string }> {
  const spec = getProviderSpec(connection.provider);
  let models: FetchedModel[] = [];
  const warnings: string[] = [];

  // responses-wire providers (codex) have no listing endpoint — static list is the catalog
  if (spec && (spec.api === "anthropic" || spec.api === "openai")) {
    try {
      models = await fetchProviderModels(connection);
    } catch (e) {
      warnings.push((e as Error).message);
    }
  }

  if (models.length === 0 && spec && spec.models.length > 0) {
    models = spec.models.map((id) => ({
      modelId: id,
      displayName: null,
      contextWindow: null,
      thinking: false,
      input: [] as ("text" | "image" | "video")[],
      thinkingLevel: [] as string[],
      temperature: false,
      limitContext: null,
      limitInput: null,
      limitOutput: null,
      costInput: null,
      costOutput: null,
      costCacheRead: null,
      output: [] as string[],
    }));
  }

  const catalog = await modelsDevCatalog();
  if (catalog) {
    models = models.map((m) => enrich(m, modelsDevLookup(catalog, connection.provider, m.modelId)));
  } else if (models.length > 0) {
    warnings.push("models.dev metadata unavailable");
  }

  await connections.replaceModels(connection.id, models);
  return { count: models.length, warning: warnings.length > 0 ? warnings.join("; ") : undefined };
}

// --- Quota collection -----------------------------------------------------

export interface QuotaSnapshot {
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  resetAt: string | null;
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

type LiveConn = LlmConnectionRow & { configParsed: ConnectionConfig };
type QuotaCollector = (connection: LiveConn, ctx: QuotaCtx) => Promise<QuotaSnapshot[]>;

interface QuotaCtx {
  db: Kysely<TwoRouteDb>;
  encrypt: (s: string) => string;
}

/** Claude Code: oauth usage endpoint — 5h/weekly percent windows, per-model weeklies, extra-usage pool. */
async function collectClaudeCode(connection: LiveConn, ctx: QuotaCtx): Promise<QuotaSnapshot[]> {
  const config = await ensureFreshTokens(connection, ctx.db, ctx.encrypt);
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
      ["seven_day_opus", "weekly-opus"],
      ["seven_day_sonnet", "weekly-sonnet"],
    ] as const) {
      if (snap.some((s) => s.quotaType === type)) continue;
      const win = asRecord(root[key]);
      if (!win) continue;
      const used = finite(win.utilization ?? win.usedPercent ?? win.used_percent);
      if (used === undefined) continue;
      const resetRaw = win.resets_at ?? win.resetIso ?? win.ends_at;
      const resetMs = finite(win.resetAt ?? win.reset_at);
      snap.push({
        quotaType: type,
        groupName: "default",
        unit: "percent",
        quotaTotal: 100,
        quotaUsed: Math.max(0, Math.min(100, used)),
        resetAt: typeof resetRaw === "string" && resetRaw ? resetRaw : resetMs && resetMs > 0 ? new Date(resetMs).toISOString() : null,
      });
    }

    // pay-as-you-go overage pool on top of the subscription windows
    if (snap.some((s) => s.quotaType === "extra")) continue;
    const extra = asRecord(root.extra_usage);
    if (extra?.is_enabled !== true) continue;
    const limit = finite(extra.monthly_limit);
    const usedCredits = finite(extra.used_credits);
    const pct = finite(extra.utilization);
    if (limit === undefined && usedCredits === undefined && pct === undefined) continue;
    snap.push({
      quotaType: "extra",
      groupName: "default",
      unit: limit !== undefined && limit > 0 ? "credits" : "percent",
      quotaTotal: limit !== undefined && limit > 0 ? limit : 100,
      quotaUsed: Math.max(0, usedCredits ?? Math.min(100, pct ?? 0)),
      resetAt: null,
    });
  }
  if (snap.length === 0) throw new Error(`unrecognized usage payload: ${JSON.stringify(json).slice(0, 250)}`);
  return snap;
}

/** Codex (ChatGPT): wham usage endpoint — primary (5h) + secondary (weekly) percent windows. */
async function collectCodex(connection: LiveConn, ctx: QuotaCtx): Promise<QuotaSnapshot[]> {
  const config = await ensureFreshTokens(connection, ctx.db, ctx.encrypt);
  const token = config.access_token;
  if (!token) throw new Error("missing OAuth access token");

  const json = await fetchJson("https://chatgpt.com/backend-api/wham/usage", {
    authorization: `Bearer ${token}`,
    ...((config.account_id ?? config.accountId) ? { "chatgpt-account-id": String(config.account_id ?? config.accountId) } : {}),
  });

  const rateLimit = asRecord(asRecord(json)?.rate_limit) ?? asRecord(json);
  if (!rateLimit) throw new Error(`unrecognized usage payload: ${JSON.stringify(json).slice(0, 250)}`);

  const typeFor = (seconds: number | undefined, fallback: string): string =>
    seconds === 18000 ? "5h" : seconds === 86400 ? "daily" : seconds === 604800 ? "weekly" : fallback;

  const snap: QuotaSnapshot[] = [];
  for (const [key, fallback] of [
    ["primary_window", "5h"],
    ["secondary_window", "weekly"],
  ] as const) {
    const win = asRecord(rateLimit[key]);
    if (!win) continue;
    const used = finite(win.used_percent ?? win.usedPercent);
    if (used === undefined) continue;
    const resetSec = finite(win.reset_at);
    snap.push({
      quotaType: typeFor(finite(win.limit_window_seconds), fallback),
      groupName: "default",
      unit: "percent",
      quotaTotal: 100,
      quotaUsed: Math.max(0, Math.min(100, used)),
      resetAt: resetSec && resetSec > 0 ? new Date(resetSec * 1000).toISOString() : null,
    });
  }
  if (snap.length === 0) throw new Error(`unrecognized usage payload: ${JSON.stringify(json).slice(0, 250)}`);
  return snap;
}

/** z.ai: monitor API with percentage windows keyed by limit type/unit. */
async function collectZai(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const apiKey = connection.configParsed.api_key ?? connection.api_key;
  if (!apiKey) throw new Error("missing API key");

  const json = await fetchJson("https://api.z.ai/api/monitor/usage/quota/limit", {
    authorization: apiKey,
    "user-agent": "tworoute/1.0",
    "content-type": "application/json",
  });

  const limits = asRecord(asRecord(json)?.data)?.limits;
  if (!Array.isArray(limits)) throw new Error("invalid z.ai quota response");

  const snap: QuotaSnapshot[] = [];
  for (const raw of limits) {
    const limit = asRecord(raw);
    if (!limit) continue;
    const percentage = finite(limit.percentage);
    const type = typeof limit.type === "string" ? limit.type : "";
    const unitCode = finite(limit.unit);
    let quotaType: string | null = null;
    if (type === "TOKENS_LIMIT" || type === "CREDIT_LIMIT") {
      if (unitCode === 3) quotaType = "5h";
      else if (unitCode === 4) quotaType = "daily";
      else if (unitCode === 6) quotaType = "weekly";
    } else if (type === "TIME_LIMIT") {
      quotaType = "monthly";
    }
    if (!quotaType) continue;
    const resetMs = finite(limit.nextResetTime);

    if (type === "CREDIT_LIMIT") {
      // credit plans report real values: usage = credits per window, currentValue = consumed
      const total = finite(limit.usage);
      const used = finite(limit.currentValue) ?? finite(limit.used);
      if (total !== undefined && used !== undefined) {
        snap.push({
          quotaType,
          groupName: "default",
          unit: "credits",
          quotaTotal: total,
          quotaUsed: Math.max(0, used),
          resetAt: resetMs && resetMs > 0 ? new Date(resetMs).toISOString() : null,
        });
        continue;
      }
    }

    if (percentage === undefined) continue;
    snap.push({
      quotaType,
      groupName: "default",
      unit: "percent",
      quotaTotal: 100,
      quotaUsed: Math.max(0, Math.min(100, percentage)),
      resetAt: resetMs && resetMs > 0 ? new Date(resetMs).toISOString() : null,
    });
  }
  return snap;
}

/** Kimi for Coding: usages endpoint with used/limit token windows. */
async function collectKimi(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const apiKey = connection.configParsed.api_key ?? connection.api_key;
  if (!apiKey) throw new Error("missing API key");

  const json = await fetchJson("https://api.kimi.com/coding/v1/usages", {
    authorization: `Bearer ${apiKey}`,
    "user-agent": "tworoute/1.0",
  });

  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  const usage = asRecord(data?.usage);
  const limits = data?.limits;

  const parseReset = (rec: Record<string, unknown>): string | null => {
    for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
      const v = rec[key];
      if (typeof v === "string" && v.trim()) {
        const t = Date.parse(v);
        if (Number.isFinite(t)) return new Date(t).toISOString();
      }
    }
    for (const key of ["reset_in", "resetIn", "ttl"]) {
      const seconds = finite(rec[key]);
      if (seconds !== undefined && seconds > 0) return new Date(Date.now() + seconds * 1000).toISOString();
    }
    const win = asRecord(rec.window);
    const seconds = win ? finite(win.duration) : undefined;
    if (seconds !== undefined && seconds > 0) return new Date(Date.now() + seconds * 1000).toISOString();
    return null;
  };

  const typeFromLabel = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes("5h") || l.includes("5 h")) return "5h";
    if (l.includes("week") || l.includes("7d")) return "weekly";
    if (l.includes("month") || l.includes("30d")) return "monthly";
    return "daily";
  };

  const windows: { label: string; used: number; limit: number; resetAt: string | null }[] = [];
  const pushWindow = (rec: Record<string, unknown>, fallbackLabel: string) => {
    const limit = finite(rec.limit);
    let used = finite(rec.used);
    if (used === undefined) {
      const remaining = finite(rec.remaining);
      if (remaining !== undefined && limit !== undefined) used = limit - remaining;
    }
    if (used === undefined && limit === undefined) return;
    const label =
      (typeof rec.name === "string" && rec.name.trim() ? rec.name : typeof rec.title === "string" && rec.title.trim() ? rec.title : null) ?? fallbackLabel;
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

/** Ollama Cloud: scrapes the settings page with the browser session cookie. */
async function collectOllamaCloud(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const session = connection.configParsed.sessionToken?.trim() ?? connection.configParsed.session_token?.trim();
  if (!session) throw new Error("missing session token — set it on the connection (ollama.com __Secure-session cookie)");

  const res = await fetch("https://ollama.com/settings", {
    headers: { cookie: `__Secure-session=${session}`, "user-agent": "tworoute/1.0", accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ollama.com returned ${res.status}`);
  const html = await res.text();

  const balanceMatch = html.match(/id="usage-credits-balance"[^>]*>\s*\$([\d,.]+)/);
  const total = balanceMatch ? Number(balanceMatch[1].replace(/,/g, "")) : undefined;

  const meterMatch = html.match(/aria-label="Monthly credits used:\s*\$([\d,.]+)\s+of\s+\$([\d,.]+)"/);
  const used = meterMatch ? Number(meterMatch[1].replace(/,/g, "")) : undefined;
  const monthlyTotal = meterMatch ? Number(meterMatch[2].replace(/,/g, "")) : undefined;

  const extraMatch = html.match(/id="extra-usage-balance"[^>]*>\s*\$([\d,.]+)/);
  const added = extraMatch ? Number(extraMatch[1].replace(/,/g, "")) : undefined;

  const refillMatch = html.match(/Refills to \$[\d,.]+ on ([A-Z][a-z]+ \d{1,2}, \d{4})/);

  if (total === undefined && used === undefined) throw new Error("could not parse ollama.com credits — page layout may have changed");

  const snap: QuotaSnapshot[] = [];
  const resetAt = refillMatch ? new Date(refillMatch[1]).toISOString() : null;

  // Primary: monthly included credits — grant vs spent, resets at refill date.
  if (used !== undefined && monthlyTotal !== undefined) {
    snap.push({ quotaType: "credits", groupName: "default", unit: "usd", quotaTotal: monthlyTotal, quotaUsed: used, resetAt });
  } else if (total !== undefined) {
    // Meter absent (fresh account?) — fall back to raw balance.
    snap.push({ quotaType: "credits", groupName: "default", unit: "usd", quotaTotal: total, quotaUsed: 0, resetAt });
  }
  // Purchased add-on balance (shown as remaining).
  if (added !== undefined && added > 0) {
    snap.push({ quotaType: "added", groupName: "default", unit: "usd", quotaTotal: added, quotaUsed: 0, resetAt: null });
  }
  return snap;
}

/** MiniMax coding plan: remains endpoint with 5h + weekly count windows. */
async function collectMinimax(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const token = connection.configParsed.api_key ?? connection.api_key;
  if (!token) throw new Error("missing API key");

  const json = (await fetchJson("https://api.minimax.io/v1/api/openplatform/coding_plan/remains", {
    authorization: `Bearer ${token}`,
  })) as { base_resp?: { status_code?: number; status_msg?: string }; model_remains?: unknown };

  const status = json.base_resp?.status_code;
  if (status !== undefined && status !== 0) {
    throw new Error(`minimax error ${status}: ${json.base_resp?.status_msg ?? "unknown"}`);
  }
  if (!Array.isArray(json.model_remains)) throw new Error("invalid minimax remains response");

  const general = json.model_remains.map(asRecord).find((r) => typeof r?.model_name === "string" && r.model_name.trim().toLowerCase() === "general");
  if (!general) return [];

  const build = (quotaType: string, totalKey: string, usedKey: string, remainingKey: string, resetKey: string): QuotaSnapshot | null => {
    const total = finite(general[totalKey]);
    const used = finite(general[usedKey]);
    const remainingPercent = finite(general[remainingKey]);
    if (remainingPercent === undefined && (total === undefined || used === undefined)) return null;
    const resolvedUsed = used ?? (remainingPercent !== undefined ? 100 - Math.max(0, Math.min(100, remainingPercent)) : 0);
    const resolvedTotal = total && total > 0 ? total : 100;
    const resetMs = finite(general[resetKey]);
    return {
      quotaType,
      groupName: "default",
      unit: total && total > 0 ? "Tk" : "percent",
      quotaTotal: resolvedTotal,
      quotaUsed: Math.max(0, resolvedUsed),
      resetAt: resetMs && resetMs > 0 ? new Date(resetMs).toISOString() : null,
    };
  };

  const snap: QuotaSnapshot[] = [];
  const five = build("5h", "current_interval_total_count", "current_interval_usage_count", "current_interval_remaining_percent", "end_time");
  if (five) snap.push(five);
  const weekly = build("weekly", "current_weekly_total_count", "current_weekly_usage_count", "current_weekly_remaining_percent", "weekly_end_time");
  if (weekly) snap.push(weekly);
  return snap;
}

/** Kilo Code: profile balance (pay-as-you-go credit pool, USD). */
async function collectKilo(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const apiKey = connection.configParsed.api_key ?? connection.api_key;
  if (!apiKey) throw new Error("missing API key");

  const json = (await fetchJson("https://app.kilo.ai/api/profile/balance", {
    authorization: `Bearer ${apiKey}`,
  })) as { balance?: unknown; isDepleted?: unknown };

  const balance = finite(json.balance);
  if (balance === undefined) throw new Error("invalid kilo balance response");

  return [
    {
      quotaType: "credits",
      groupName: "default",
      unit: "usd",
      quotaTotal: null, // pay-as-you-go: no fixed cap, show remaining only
      quotaUsed: Number(balance.toFixed(4)),
      resetAt: null,
    },
  ];
}

/** Cline: plan usage-limits endpoint (needs the account API key, not the gateway OAuth token). */
async function collectCline(connection: LiveConn): Promise<QuotaSnapshot[]> {
  const key = connection.configParsed.api_key ?? connection.api_key ?? connection.configParsed.accessToken;
  if (!key) throw new Error("missing API key — generate one in your Cline account settings and set it on the connection");

  const json = await fetchJson("https://api.cline.bot/api/v1/users/me/plan/usage-limits", {
    authorization: `Bearer ${key}`,
  });
  const data = asRecord(asRecord(json)?.data) ?? asRecord(json);
  if (!data) throw new Error(`unrecognized usage payload: ${JSON.stringify(json).slice(0, 250)}`);

  const snap: QuotaSnapshot[] = [];

  // anthropic-style percent windows
  for (const [key2, type] of [
    ["five_hour", "5h"],
    ["seven_day", "weekly"],
  ] as const) {
    const win = asRecord(data[key2] ?? data[key2 === "five_hour" ? "fiveHour" : "sevenDay"]);
    const used = win ? finite(win.usedPercent ?? win.used_percent ?? win.percent ?? win.percentage) : undefined;
    if (used === undefined) continue;
    snap.push({ quotaType: type, groupName: "default", unit: "percent", quotaTotal: 100, quotaUsed: Math.max(0, Math.min(100, used)), resetAt: null });
  }

  // kimi-style usage object + limits array (used/limit counts)
  const pushWindow = (rec: Record<string, unknown>, fallbackLabel: string) => {
    const limit = finite(rec.limit);
    let used = finite(rec.used);
    if (used === undefined) {
      const remaining = finite(rec.remaining);
      if (remaining !== undefined && limit !== undefined) used = limit - remaining;
    }
    if (used === undefined && limit === undefined) return;
    const label =
      (typeof rec.name === "string" && rec.name.trim() ? rec.name : typeof rec.title === "string" && rec.title.trim() ? rec.title : null) ?? fallbackLabel;
    const l = label.toLowerCase();
    const quotaType =
      l.includes("5h") || l.includes("5 h")
        ? "5h"
        : l.includes("week") || l.includes("7d")
          ? "weekly"
          : l.includes("month") || l.includes("30d")
            ? "monthly"
            : "daily";
    if (snap.some((x) => x.quotaType === quotaType)) return;
    snap.push({
      quotaType,
      groupName: "default",
      unit: limit && limit > 0 ? "Tk" : "percent",
      quotaTotal: limit && limit > 0 ? limit : 100,
      quotaUsed: Math.max(0, used ?? 0),
      resetAt: null,
    });
  };

  // cline-style flat array: [{type: "five_hour"|"weekly"|"monthly", percentUsed}]
  if (Array.isArray(data.limits)) {
    for (const raw of data.limits) {
      const item = asRecord(raw);
      if (!item) continue;
      const itemType = typeof item.type === "string" ? item.type.toLowerCase() : "";
      const quotaType =
        itemType === "five_hour" || itemType === "5h"
          ? "5h"
          : itemType === "weekly"
            ? "weekly"
            : itemType === "monthly"
              ? "monthly"
              : itemType === "daily"
                ? "daily"
                : null;
      const used = finite(item.percentUsed ?? item.percentage);
      if (!quotaType || used === undefined) continue;
      snap.push({ quotaType, groupName: "default", unit: "percent", quotaTotal: 100, quotaUsed: Math.max(0, Math.min(100, used)), resetAt: null });
    }
  }

  const usage = asRecord(data.usage);
  if (usage) pushWindow(usage, "Weekly limit");
  if (Array.isArray(data.limits)) {
    for (const raw of data.limits) {
      const item = asRecord(raw);
      if (!item) continue;
      pushWindow(asRecord(item.detail) ?? item, typeof item.scope === "string" ? item.scope : "Limit");
    }
  }

  if (snap.length === 0) throw new Error(`unrecognized usage payload: ${JSON.stringify(data).slice(0, 250)}`);
  return snap;
}

const QUOTA_COLLECTORS: Record<string, QuotaCollector> = {
  "claude-code": collectClaudeCode,
  codex: collectCodex,
  zai: collectZai,
  kimi: collectKimi,
  "ollama-cloud": collectOllamaCloud,
  minimax: collectMinimax,
  "kilo-code": collectKilo,
  cline: collectCline,
};

export function hasQuotaCollector(provider: string): boolean {
  return provider in QUOTA_COLLECTORS;
}

/** Fetch fresh quota snapshots for a connection and cache them. */
export async function refreshConnectionQuotas(
  connection: LiveConn,
  connections: ConnectionsRepo,
  ctx: QuotaCtx,
): Promise<QuotaSnapshot[]> {
  const collector = QUOTA_COLLECTORS[connection.provider];
  if (!collector) throw new Error(`quota_refresh_not_supported: ${connection.provider}`);
  const snapshots = await collector(connection, ctx);

  for (const snap of snapshots) {
    await connections.upsertQuota({
      workspaceId: connection.workspace_id,
      connectionId: connection.id,
      ...snap,
    });
  }
  await connections.replaceDefaultQuotas(connection.id, [...new Set(snapshots.map((s) => s.quotaType))]);
  return snapshots;
}
