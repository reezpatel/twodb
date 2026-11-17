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
    return fetch(joinUrl(connection.base_url, "/chat/completions"), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(req),
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
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
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
        messages: rest,
        stream: req.stream ?? false,
        max_tokens: req.max_tokens ?? (budgetTokens >= 8192 ? budgetTokens * 2 : 8192),
        temperature: req.temperature,
        ...(thinkingParam ? { thinking: thinkingParam } : {}),
        ...(outputConfig ? { output_config: outputConfig } : {}),
        ...(req.tools?.length
          ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
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
    const instructions = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const input = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
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
              tools: req.tools.map((t) => ({
                type: "function",
                name: t.name,
                description: t.description,
                parameters: t.parameters,
                strict: false,
              })),
              tool_choice: "auto",
            }
          : {}),
      }),
    });
  },

  // chatgpt backend has no model-listing endpoint — static catalog is the list.
  listModels: async () => null,
};
