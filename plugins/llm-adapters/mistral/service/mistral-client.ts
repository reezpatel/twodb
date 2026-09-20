import type {
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbContentPart,
  TwodbFinishReason,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolCall,
  TwodbToolChoice,
  TwodbUsage,
} from "@twodb/contracts";

export type MistralClientOptions = {
  url: string;
  apiKey?: string;
};

const COMPLETIONS_TIMEOUT_MS = 120_000;

type MistralContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: string };

type MistralMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | MistralContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: TwodbToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

type MistralRequestBody = {
  model: string;
  messages: MistralMessage[];
  tools?: TwodbTool[];
  tool_choice?: TwodbToolChoice;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: TwodbCompletionRequest["response_format"];
  stop?: string[];
  stream: boolean;
  stream_options?: { include_usage: boolean };
};

type MistralUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type MistralResponseChoice = {
  index?: number;
  message?: { role?: string; content?: string | null; tool_calls?: TwodbToolCall[] };
  finish_reason?: string | null;
};

type MistralResponse = {
  id?: string;
  model?: string;
  choices?: MistralResponseChoice[];
  usage?: MistralUsage;
};

type MistralStreamChoice = {
  index?: number;
  delta?: {
    content?: string | null;
    tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
  };
  finish_reason?: string | null;
};

type MistralStreamChunk = {
  id?: string;
  model?: string;
  choices?: MistralStreamChoice[];
  usage?: MistralUsage | null;
};

export function resolveChatCompletionsUrl(baseUrl: string, fallback: string): string {
  const trimmed = (baseUrl.trim() || fallback.trim()).replace(/\/+$/, "");
  if (!trimmed) throw new Error("missing base URL");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/chat/completions`;
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function toContentParts(parts: TwodbContentPart[]): MistralContentPart[] {
  return parts.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    return { type: "image_url", image_url: part.url };
  });
}

function toMessages(request: TwodbCompletionRequest): MistralMessage[] {
  return request.messages.map((message): MistralMessage => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.tool_call_id,
        ...(message.name ? { name: message.name } : {}),
        content: message.content,
      };
    }
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content,
        ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
      };
    }
    if (message.role === "system") return { role: "system", content: message.content };
    return {
      role: "user",
      content: typeof message.content === "string" ? message.content : toContentParts(message.content),
    };
  });
}

function buildBody(request: TwodbCompletionRequest, stream: boolean): MistralRequestBody {
  return {
    model: request.model,
    messages: toMessages(request),
    ...(request.tools?.length ? { tools: request.tools } : {}),
    ...(request.tool_choice !== undefined ? { tool_choice: request.tool_choice } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.max_tokens !== undefined ? { max_tokens: request.max_tokens } : {}),
    ...(request.response_format ? { response_format: request.response_format } : {}),
    ...(request.stop?.length ? { stop: request.stop } : {}),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : { stream: false }),
  };
}

function mapFinishReason(reason: string | null | undefined): TwodbFinishReason {
  switch (reason) {
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "content_filter":
      return "content_filter";
    default:
      return "stop";
  }
}

function mapUsage(usage: MistralUsage | null | undefined): TwodbUsage | undefined {
  if (!usage || typeof usage.prompt_tokens !== "number" || typeof usage.completion_tokens !== "number") {
    return undefined;
  }
  return {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
  };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`invalid JSON response: ${sanitizeError(text)}`);
  }
}

async function post(url: string, body: MistralRequestBody, options: MistralClientOptions): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(options.apiKey ?? ""),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(COMPLETIONS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  return response;
}

export async function completeChatCompletion(request: TwodbCompletionRequest, options: MistralClientOptions): Promise<TwodbCompletionResponse> {
  const response = await post(options.url, buildBody(request, false), options);
  const payload = parseJson<MistralResponse>(await response.text());
  return {
    id: payload.id ?? "",
    model: payload.model ?? request.model,
    choices: (payload.choices ?? []).map((choice) => ({
      index: choice.index ?? 0,
      message: {
        role: "assistant" as const,
        content: choice.message?.content ?? null,
        ...(choice.message?.tool_calls?.length ? { tool_calls: choice.message.tool_calls } : {}),
      },
      finish_reason: mapFinishReason(choice.finish_reason),
    })),
    ...(mapUsage(payload.usage) ? { usage: mapUsage(payload.usage) } : {}),
  };
}

export async function* streamChatCompletion(request: TwodbCompletionRequest, options: MistralClientOptions): AsyncGenerator<TwodbStreamEvent> {
  const response = await post(options.url, buildBody(request, true), options);
  if (!response.body) throw new Error("API returned an empty response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = /\r?\n\r?\n/.exec(buffer);
    while (boundary !== null) {
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = /\r?\n\r?\n/.exec(buffer);

      for (const line of rawEvent.split("\n")) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trimStart();
        if (!data || data === "[DONE]") continue;

        const chunk = parseJson<MistralStreamChunk>(data);
        if (!started) {
          started = true;
          yield { type: "start", id: chunk.id ?? "", model: chunk.model ?? request.model };
        }

        const usage = mapUsage(chunk.usage);
        if (usage) yield { type: "usage", usage };

        for (const choice of chunk.choices ?? []) {
          const index = choice.index ?? 0;
          const delta = choice.delta;
          if (delta) {
            const content = typeof delta.content === "string" ? delta.content : undefined;
            const toolCalls = delta.tool_calls
              ? delta.tool_calls.map((call) => ({
                  index: call.index ?? index,
                  id: call.id ?? "",
                  type: "function" as const,
                  function: { name: call.function?.name ?? "", arguments: call.function?.arguments ?? "" },
                }))
              : undefined;
            if (content !== undefined || (toolCalls?.length ?? 0) > 0) {
              yield {
                type: "chunk",
                index,
                delta: {
                  ...(content !== undefined ? { content } : {}),
                  ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
                },
              };
            }
          }
          if (choice.finish_reason) {
            yield { type: "finish", index, finish_reason: mapFinishReason(choice.finish_reason) };
          }
        }
      }
    }
  }
}
