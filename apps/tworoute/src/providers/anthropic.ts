import type { LlmProvider, ChatMessage } from "./types.js";

function toAnthropicMessages(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  return { system: system || undefined, messages: rest };
}

/** Anthropic's native Messages API — different request shape than OpenAI, so this translates. */
export const anthropicProvider: LlmProvider = {
  async streamCompletion(connection, req) {
    const { system, messages } = toAnthropicMessages(req.messages);
    return fetch(new URL("/v1/messages", connection.base_url || "https://api.anthropic.com"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": connection.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model,
        system,
        messages,
        stream: req.stream ?? false,
        max_tokens: req.max_tokens ?? 1024,
        temperature: req.temperature,
      }),
    });
  },
};
