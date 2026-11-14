import type { ArtisanConfig } from "./config.js";

/**
 * TwoRoute client — models metadata + streaming chat completions.
 * Artisan authenticates with the workspace API key (`Bearer <conn>/<model>`
 * ids in the model field, key in the Authorization header).
 */

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  connection: string;
  contextWindow: number | null;
  /** Supports extended thinking. */
  thinking?: boolean;
  /** Thinking levels the model supports (low|medium|high|max). */
  thinkingLevel?: string[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_tokens?: number;
}

interface ChatChoice {
  delta?: {
    content?: string | null;
    /** OpenAI-style reasoning field. */
    reasoning?: string | null;
    /** GLM/Zhipu-style reasoning field (what TwoRoute actually forwards). */
    reasoning_content?: string | null;
    tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
  };
  finish_reason?: string | null;
}

/** Normalized chunk — delta/finish_reason lifted out of choices[0]. */
export interface ChatChunk {
  delta?: ChatChoice["delta"];
  finish_reason?: string | null;
  usage?: ChatUsage | null;
}

export class TworouteClient {
  constructor(
    private readonly config: ArtisanConfig,
    private readonly apiKey: string,
  ) {}

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.config.TWOROUTE_URL}/v1/models`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`tworoute /v1/models ${res.status}`);
    const body = (await res.json()) as {
      data?: Array<{
        id: string;
        owned_by?: string;
        context_window?: number;
        thinking?: boolean;
        thinking_level?: string[];
      }>;
    };
    return (body.data ?? []).map((m) => {
      const [conn, ...rest] = m.id.split("/");
      return {
        id: m.id,
        name: rest.join("/") || m.id,
        provider: m.owned_by ?? "",
        connection: conn,
        contextWindow: m.context_window ?? null,
        thinking: Boolean(m.thinking),
        thinkingLevel: m.thinking_level ?? [],
      };
    });
  }

  async getModel(id: string): Promise<ModelInfo | undefined> {
    const models = await this.listModels();
    return models.find((m) => m.id === id);
  }

  /** Streaming chat completion — yields parsed SSE chunks. */
  async *streamChat(input: {
    model: string;
    messages: ChatMessage[];
    tools?: ToolDef[];
    maxTokens?: number;
    signal?: AbortSignal;
    /** Thinking effort (low|medium|high|max) forwarded to the provider. */
    effort?: string | null;
  }): AsyncGenerator<ChatChunk> {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: input.messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (input.tools?.length) body.tools = input.tools;
    if (input.maxTokens) body.max_tokens = input.maxTokens;
    if (input.effort) body.effort = input.effort;

    const res = await fetch(`${this.config.TWOROUTE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: input.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`tworoute chat ${res.status}: ${text.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const raw = JSON.parse(data) as { choices?: ChatChoice[]; usage?: ChatUsage };
          const choice = raw.choices?.[0];
          yield { delta: choice?.delta, finish_reason: choice?.finish_reason ?? null, usage: raw.usage ?? null };
        } catch {
          // skip malformed keepalives
        }
      }
    }
  }
}
