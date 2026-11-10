import type { LlmProvider } from "./types.js";
import { getProviderSpec } from "./catalog.js";
import { joinUrl } from "./url.js";
import type { ConnectionConfig } from "../db/repository.js";

/**
 * Wire adapters, driven by the provider catalog's `api` + `auth` fields
 * (legacy called this per-provider functions; here one adapter per wire).
 * Credential choice (api key vs access token) follows the catalog's authKey.
 */

function credential(connection: { api_key: string; configParsed: ConnectionConfig }): string {
  const spec = getProviderSpec(
    // provider id lives on the connection row; adapter is selected by caller
    (connection as unknown as { provider: string }).provider,
  );
  if (spec?.authKey) {
    const fromConfig = connection.configParsed[spec.authKey];
    if (fromConfig) return fromConfig;
  }
  return connection.api_key;
}

function authHeaders(
  spec: ReturnType<typeof getProviderSpec>,
  connection: { api_key: string; configParsed: ConnectionConfig },
): Record<string, string> {
  if (!spec) return {};
  if (spec.auth === "x-api-key") return { "x-api-key": credential(connection) };
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
    return fetch(joinUrl(connection.base_url || "https://api.anthropic.com", "/v1/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
        "anthropic-version": "2023-06-01",
        ...(spec?.auth === "claude-oauth" ? { "anthropic-beta": "oauth-2025-04-20" } : {}),
      },
      body: JSON.stringify({
        model: req.model,
        system: system || undefined,
        messages: rest,
        stream: req.stream ?? false,
        max_tokens: req.max_tokens ?? 1024,
        temperature: req.temperature,
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
    if (connection.configParsed.accountId) headers["chatgpt-account-id"] = connection.configParsed.accountId;
    // Responses wire: messages become input items; system becomes instructions.
    const instructions = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const input = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return fetch(joinUrl(connection.base_url, "/responses"), {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        model: req.model,
        instructions: instructions || undefined,
        input,
        stream: req.stream ?? false,
        temperature: req.temperature,
        max_output_tokens: req.max_tokens,
      }),
    });
  },

  // chatgpt backend has no model-listing endpoint — static catalog is the list.
  listModels: async () => null,
};
