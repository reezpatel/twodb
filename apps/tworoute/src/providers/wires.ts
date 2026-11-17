import type { LlmProvider } from "./types.js";
import { getProviderSpec } from "./catalog.js";
import { joinUrl } from "./url.js";
import type { ConnectionConfig } from "../db/repository.js";

/**
 * Wire adapters, driven by the provider catalog's `api` + `auth` fields
 * (legacy called this per-provider functions; here one adapter per wire).
 * Credential choice (api key vs access token) follows the catalog's authKey.
 */

/** Credential lookup tolerant of both config casings (UI camelCase,
 * legacy-import snake_case) — mirrors token-refresh.ts's normalization. */
function configGet(config: ConnectionConfig, camel: string, snake: string): string | undefined {
  return config[camel] ?? config[snake];
}

function credential(connection: { provider: string; api_key: string; configParsed: ConnectionConfig }): string {
  const spec = getProviderSpec(connection.provider);
  if (spec?.authKey) {
    const fromConfig = configGet(connection.configParsed, spec.authKey, snakeOf(spec.authKey));
    if (fromConfig) return fromConfig;
  }
  return connection.api_key;
}

/** camelCase → snake_case for the legacy-config keys (accessToken → access_token). */
function snakeOf(camel: string): string {
  return camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Normalize both tool shapes to flat {name, description, parameters}. */
function flatTool(t: import("./types.js").ChatTool): { name: string; description: string; parameters: Record<string, unknown> } {
  const f = t.function;
  return {
    name: t.name ?? f?.name ?? "",
    description: t.description ?? f?.description ?? "",
    parameters: t.parameters ?? f?.parameters ?? { type: "object", properties: {} },
  };
}

// Messages arrive OpenAI-shaped ({role, content, tool_calls, tool_call_id}).
// Anthropic wants assistant tool_use blocks and tool_result blocks in a *user*
// turn. Map faithfully; repair pairing so a tool_use never dangles and a
// tool_result never orphans (crash between call and result, history read out
// of order). Provider hard-400s otherwise.
type RawMessage = { role?: string; content?: string | null; tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: unknown } }>; tool_call_id?: string };

function anthropicMessages(messages: RawMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content ?? "").filter(Boolean).join("\n\n");
  const out: unknown[] = [];
  // Index results by call id for pairing; results with no call are dropped.
  const resultById = new Map<string, string>();
  for (const m of messages) if (m.role === "tool" && m.tool_call_id) resultById.set(m.tool_call_id, m.content ?? "");
  for (const m of messages) {
    if (m.role === "system" || m.role === "tool") continue;
    if (m.role === "assistant") {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) {
        if (!tc.function?.name) continue;
        blocks.push({ type: "tool_use", id: tc.id ?? "", name: tc.function.name, input: typeof tc.function.arguments === "string" ? safeJson(tc.function.arguments) ?? {} : (tc.function.arguments ?? {}) });
      }
      out.push(blocks.length ? { role: "assistant", content: blocks } : { role: "assistant", content: m.content ?? "" });
      // Immediately following user turn carries the results for these calls.
      const results: unknown[] = [];
      for (const tc of m.tool_calls ?? []) {
        const id = tc.id ?? "";
        if (!id) continue;
        results.push({ type: "tool_result", tool_use_id: id, content: resultById.get(id) ?? "[no result recorded]" });
      }
      if (results.length) out.push({ role: "user", content: results });
    } else {
      const c = m.content ?? "";
      if (c === "" ) continue; // drop empty plain text turns — Anthropic rejects empty content
      out.push({ role: "user", content: c });
    }
  }
  // Drop any message with empty content (string "" or empty blocks array) — Anthropic 400s on them.
  const cleaned = (out as Array<{ role: string; content: unknown }>).filter((m) => {
    if (Array.isArray(m.content)) return m.content.length > 0;
    return typeof m.content === "string" && m.content.length > 0;
  });
  // Merge consecutive same-role turns (Anthropic requires strict user/assistant alternation).
  const merged: Array<{ role: string; content: unknown }> = [];
  for (const m of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = [...(Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]), ...(Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }])];
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }
  return { system, messages: merged };
}

function safeJson(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  try { return JSON.parse(data) as Record<string, unknown>; } catch { return null; }
}

function authHeaders(
  spec: ReturnType<typeof getProviderSpec>,
  connection: { provider: string; api_key: string; configParsed: ConnectionConfig },
): Record<string, string> {
  if (!spec) return {};
  if (spec.auth === "x-api-key") return { "x-api-key": credential(connection) };
  // Claude Code OAuth: send the full Claude Code identity or Anthropic bills
  // the request against API balance instead of the subscription (rate limits).
  if (spec.auth === "claude-oauth") {
    const token = credential(connection);
    if (!token) return { "x-api-key": connection.api_key };
    return {
      authorization: `Bearer ${token}`,
      "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
      "user-agent": "claude-cli/2.1.280 (external, cli)",
      "x-app": "cli",
    };
  }
  return { authorization: `Bearer ${credential(connection)}` };
}

/** OpenAI /chat/completions wire — covers most providers. */
export const openAiCompatibleProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    const spec = getProviderSpec(connection.provider);
    const headers = authHeaders(spec, connection);
    if (spec?.id === "openai" && connection.configParsed.org) headers["openai-organization"] = connection.configParsed.org;
    // Some OpenAI-compatible providers reject null/empty content; normalize.
    const messages = (req.messages as RawMessage[]).map((m) => ({ ...m, content: m.content ?? "" }));
    return fetch(joinUrl(connection.base_url, "/chat/completions"), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ ...req, messages }),
    });
  },

  async listModels(connection) {
    try {
      const spec = getProviderSpec(connection.provider);
      const res = await fetch(joinUrl(connection.base_url, "/models"), {
        headers: authHeaders(spec, connection),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: Array<{ id: string }> };
      if (!Array.isArray(body.data)) return null;
      return body.data.map((m) => m.id).sort();
    } catch {
      return null;
    }
  },
};

/** Anthropic Messages API — translates OpenAI-ish requests to its shape. */
export const anthropicProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    const { system, messages: mapped } = anthropicMessages(req.messages as RawMessage[]);
    const spec = getProviderSpec(connection.provider);
    const headers = authHeaders(spec, connection);
    const baseUrl = connection.base_url || "https://api.anthropic.com";
    const firstParty = /api\.anthropic\.com/.test(baseUrl);
    const supportsThinking =
      /claude-(?:3-7|[4-9])/.test(req.model) || /claude-(?:sonnet|opus|haiku|fable)-(?:[4-9]|latest)/.test(req.model);
    const budgetTokens: number = supportsThinking ? ({ off: 0, low: 1024, medium: 4096, high: 16384 } as Record<string, number>)[req.effort ?? "medium"] ?? 4096 : 0;
    const adaptiveModel = /claude-(?:opus-(?:4\.(?:[7-9]|1[0-9])|[5-9])|fable|mythos|sonnet-[5-9]|haiku-[5-9]|latest)/.test(req.model);
    let thinkingParam: Record<string, unknown> | undefined;
    let outputConfig: Record<string, unknown> | undefined;
    if (supportsThinking && req.effort === "off") {
      // omit
    } else if (supportsThinking && firstParty && adaptiveModel) {
      thinkingParam = { type: "adaptive", display: "summarized" };
      outputConfig = { effort: req.effort ?? "medium" };
    } else if (supportsThinking && budgetTokens > 0) {
      thinkingParam = firstParty
        ? { type: "enabled", budget_tokens: budgetTokens, display: "summarized" }
        : { type: "enabled", budget_tokens: budgetTokens };
    }
    // OAuth (Claude Code subscription) requests must lead with the Claude Code
    // identity block or Anthropic bills them against API balance.
    const systemParam =
      spec?.auth === "claude-oauth"
        ? [{ type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." }, ...(system ? [{ type: "text", text: system }] : [])]
        : system || undefined;
    return fetch(joinUrl(baseUrl, "/v1/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model,
        system: systemParam,
        messages: mapped,
        stream: req.stream ?? false,
        max_tokens: req.max_tokens ?? (budgetTokens >= 8192 ? budgetTokens * 2 : 8192),
        temperature: req.temperature,
        ...(thinkingParam ? { thinking: thinkingParam } : {}),
        ...(outputConfig ? { output_config: outputConfig } : {}),
        ...(req.tools?.length
          ? { tools: req.tools.map((t) => { const f = flatTool(t); return { name: f.name, description: f.description, input_schema: f.parameters }; }) }
          : {}),
      }),
    });
  },

  // Anthropic has no public model-listing endpoint on the Messages API —
  // returning null tells callers to fall back to the static catalog.
  listModels: async () => null,
};

/** OpenAI Responses API (ChatGPT Codex backend). */
export const responsesProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    const spec = getProviderSpec(connection.provider);
    const headers = authHeaders(spec, connection);
    const accountId = connection.configParsed.accountId ?? connection.configParsed.account_id;
    if (accountId) headers["chatgpt-account-id"] = accountId;
    // Responses wire: messages become input items; system becomes instructions.
    // Assistant tool_calls become function_call items; tool results become function_call_output.
    const instructions = req.messages.filter((m) => m.role === "system").map((m) => m.content ?? "").filter(Boolean).join("\n\n");
    const input: unknown[] = [];
    for (const m of req.messages as RawMessage[]) {
      if (m.role === "system") continue;
      if (m.role === "assistant" && m.tool_calls?.length) {
        if (m.content) input.push({ role: "assistant", content: m.content });
        for (const tc of m.tool_calls) {
          if (!tc.function?.name) continue;
          input.push({ type: "function_call", call_id: tc.id ?? "", name: tc.function.name, arguments: typeof tc.function.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}) });
        }
      } else if (m.role === "tool") {
        input.push({ type: "function_call_output", call_id: m.tool_call_id ?? "", output: m.content ?? "" });
      } else {
        input.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content ?? "" });
      }
    }
    return fetch(joinUrl(connection.base_url, "/responses"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        "OpenAI-Beta": "responses=experimental",
        originator: "twodb",
        ...headers,
      },
      body: JSON.stringify({
        model: req.model,
        // chatgpt backend requires instructions + encrypted reasoning when store=false
        instructions: instructions || "You are a helpful assistant.",
        input,
        stream: req.stream ?? false,
        store: false,
        include: ["reasoning.encrypted_content"],
        reasoning: req.effort === "off" ? { effort: "minimal" } : { effort: req.effort ?? "medium", summary: "auto" },
        temperature: req.temperature,
        max_output_tokens: req.max_tokens,
        ...(req.tools?.length
          ? {
              tools: req.tools.map((t) => { const f = flatTool(t); return { type: "function", name: f.name, description: f.description, parameters: f.parameters, strict: false }; }),
              tool_choice: "auto",
            }
          : {}),
      }),
    });
  },

  // chatgpt backend has no model-listing endpoint — static catalog is the list.
  listModels: async () => null,
};
