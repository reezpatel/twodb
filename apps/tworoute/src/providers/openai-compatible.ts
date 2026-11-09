import type { LlmProvider } from "./types.js";

/**
 * Covers OpenAI itself and every OpenAI-compatible provider (most of them —
 * Groq, Together, Fireworks, local vLLM/Ollama OpenAI shims, etc). Request
 * shape is already OpenAI's `/chat/completions`, so this is a pure
 * pass-through with auth header injection.
 */
export const openAiCompatibleProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    return fetch(new URL("/chat/completions", connection.base_url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${connection.api_key}`,
      },
      body: JSON.stringify(req),
    });
  },
};
