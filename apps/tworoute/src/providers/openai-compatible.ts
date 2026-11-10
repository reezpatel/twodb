import type { LlmProvider } from "./types.js";
import { joinUrl } from "./url.js";

/**
 * Covers OpenAI itself and every OpenAI-compatible provider (most of them —
 * Groq, Together, Fireworks, local vLLM/Ollama OpenAI shims, etc). Request
 * shape is already OpenAI's `/chat/completions`, so this is a pure
 * pass-through with auth header injection.
 */
export const openAiCompatibleProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    return fetch(joinUrl(connection.base_url, "/chat/completions"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.api_key}`,
      },
      body: JSON.stringify(req),
    });
  },

  async listModels(connection) {
    try {
      const res = await fetch(joinUrl(connection.base_url, "/models"), {
        headers: { authorization: `Bearer ${connection.api_key}` },
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
