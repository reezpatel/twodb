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
  /** OpenAI-style location of the cached count (what TwoRoute actually returns). */
  prompt_tokens_details?: { cached_tokens?: number } | null;
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

const MODEL_CACHE = new Map<string, { at: number; models: ModelInfo[] }>();

/** A fixed key (user requests) or a provider yielding a fresh token per call (headless runs, see TwoDbSession.actAs). */
export type Credential = string | (() => string | Promise<string>);

export class TworouteClient {
  private async token(): Promise<string> {
    return typeof this.credential === "string" ? this.credential : this.credential();
  }

  constructor(
    private readonly config: ArtisanConfig,
    private readonly credential: Credential,
  ) {}

  /** Model list cached per (url, key) for a minute — it was refetched on every call. */
  async listModels(): Promise<ModelInfo[]> {
    const key = `${this.config.TWOROUTE_URL}|${typeof this.credential === "string" ? this.credential : "provider"}`;
    const hit = MODEL_CACHE.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.models;
    const models = await this.fetchModels();
    MODEL_CACHE.set(key, { at: Date.now(), models });
    return models;
  }

  private async fetchModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.config.TWOROUTE_URL}/v1/models`, {
      headers: { authorization: `Bearer ${await this.token()}` },
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

    // The connection phase is retried (a restarting TwoRoute/gateway, a 5xx, a rate limit): nothing has been streamed yet,
    // so a retry cannot duplicate output, and a long run is not lost to one blip. A user stop still wins immediately.
    const payload = JSON.stringify(body);
    const delays = [1_500, 4_000, 10_000];
    let res: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${this.config.TWOROUTE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
          body: payload,
          signal: input.signal,
        });
        const transient = res.status >= 500 || res.status === 429;
        if (!transient || attempt >= delays.length) break;
        await res.body?.cancel().catch(() => undefined);
      } catch (err) {
        if (input.signal?.aborted || attempt >= delays.length) throw err;
      }
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delays[attempt]);
        input.signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
      });
    }
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
          const usage = raw.usage
            ? { ...raw.usage, cached_tokens: raw.usage.cached_tokens ?? raw.usage.prompt_tokens_details?.cached_tokens ?? 0 }
            : null;
          yield { delta: choice?.delta, finish_reason: choice?.finish_reason ?? null, usage };
        } catch {
          // skip malformed keepalives
        }
      }
    }
  }
}
