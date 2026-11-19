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

const MAX_RETRIES = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

function backoffMs(attempt: number, retryAfterHeader: string | null) {
  const retryAfter = Number(retryAfterHeader);
  if (retryAfter > 0) return Math.min(retryAfter * 1000, MAX_DELAY_MS);
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return exp / 2 + Math.random() * (exp / 2);
}

function abortableSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

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
    /** Called with a human-readable status while the connection is retried. */
    onRetry?: (info: { attempt: number; maxRetries: number; delayMs: number; message: string }) => void;
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

    // Retry the connection phase (a restarting TwoRoute/gateway, 408/425/429/5xx) with
    // exponential backoff + jitter and honouring Retry-After. Nothing has been streamed yet,
    // so a retry cannot duplicate output. A user stop still wins immediately.
    const payload = JSON.stringify(body);
    let res: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${this.config.TWOROUTE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
          body: payload,
          signal: input.signal,
        });
        const transient = res.status === 408 || res.status === 425 || res.status === 429 || (res.status >= 500 && res.status !== 501);
        if (!transient || attempt >= MAX_RETRIES) break;
        const delay = backoffMs(attempt, res.headers.get("retry-after"));
        input.onRetry?.({ attempt: attempt + 1, maxRetries: MAX_RETRIES, delayMs: Math.round(delay), message: `provider returned ${res.status}` });
        await res.body?.cancel().catch(() => undefined);
        await abortableSleep(delay, input.signal);
      } catch (err) {
        if (input.signal?.aborted || attempt >= MAX_RETRIES) throw err;
        const delay = backoffMs(attempt, null);
        const cause = (err as { cause?: { code?: string; message?: string } }).cause;
        const causeText = cause?.code ?? cause?.message;
        input.onRetry?.({ attempt: attempt + 1, maxRetries: MAX_RETRIES, delayMs: Math.round(delay), message: `${(err as Error).message}${causeText ? ` (${causeText})` : ""}` });
        await abortableSleep(delay, input.signal);
      }
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`tworoute chat ${res.status}: ${text.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    // A stalled SSE stream (provider stuck at quota, dead connection) can hang
    // reader.read() for minutes — race it against the abort signal so Stop
    // still works instead of leaving the session "thinking".
    const abortableRead = (): Promise<{ done: boolean; value: Uint8Array | undefined }> =>
      new Promise((resolve, reject) => {
        if (input.signal?.aborted) return reject(input.signal.reason);
        reader.read().then((r) => resolve({ done: r.done ?? false, value: r.value }), reject);
        input.signal?.addEventListener("abort", () => reject(input.signal!.reason), { once: true });
      });
    let buf = "";
    for (;;) {
      if (input.signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        throw input.signal.reason;
      }
      const { done, value } = await abortableRead();
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
