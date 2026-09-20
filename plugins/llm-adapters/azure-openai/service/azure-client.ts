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

export type AzureOpenAiClientOptions = {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  deploymentMap: string;
};

const COMPLETIONS_TIMEOUT_MS = 120_000;

type AzureContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

type AzureMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | AzureContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: TwodbToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

type AzureRequestBody = {
  messages: AzureMessage[];
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

type AzureUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
  prompt_tokens_details?: { cached_tokens?: number };
};

type AzureResponseChoice = {
  index?: number;
  message?: { role?: string; content?: string | null; tool_calls?: TwodbToolCall[] };
  finish_reason?: string | null;
};

type AzureResponse = {
  id?: string;
  model?: string;
  choices?: AzureResponseChoice[];
  usage?: AzureUsage;
};

type AzureStreamChoice = {
  index?: number;
  delta?: {
    content?: string | null;
    reasoning_content?: string | null;
    reasoning?: string | null;
    tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
  };
  finish_reason?: string | null;
};

type AzureStreamChunk = {
  id?: string;
  model?: string;
  choices?: AzureStreamChoice[];
  usage?: AzureUsage | null;
};

export function resolveDeployment(model: string, deploymentMap: string): string {
  for (const entry of deploymentMap.split(",")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key && value && key === model) return value;
  }
  return model;
}

function buildUrl(options: AzureOpenAiClientOptions, model: string): string {
  const base = options.baseUrl.replace(/\/+$/, "");
  const deployment = encodeURIComponent(resolveDeployment(model, options.deploymentMap));
  const version = encodeURIComponent(options.apiVersion);
  return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["api-key"] = apiKey;
  return headers;
}

function toContentParts(parts: TwodbContentPart[]): AzureContentPart[] {
  return parts.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") {
      return {
        type: "image_url",
        image_url: { url: part.url, ...(part.detail ? { detail: part.detail } : {}) },
      };
    }
    return { type: "input_audio", input_audio: { data: part.url, format: part.format ?? "wav" } };
  });
}

function toMessages(request: TwodbCompletionRequest): AzureMessage[] {
  return request.messages.map((message): AzureMessage => {
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

function buildBody(request: TwodbCompletionRequest, stream: boolean): AzureRequestBody {
  return {
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

function mapUsage(usage: AzureUsage | null | undefined): TwodbUsage | undefined {
  if (!usage || typeof usage.prompt_tokens !== "number" || typeof usage.completion_tokens !== "number") {
    return undefined;
  }
  const reasoning = usage.completion_tokens_details?.reasoning_tokens;
  const cached = usage.prompt_tokens_details?.cached_tokens;
  return {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    ...(typeof reasoning === "number" ? { reasoning_tokens: reasoning } : {}),
    ...(typeof cached === "number" ? { cached_input_tokens: cached } : {}),
  };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`invalid JSON response: ${sanitizeError(text)}`);
  }
}

async function post(url: string, body: AzureRequestBody, options: AzureOpenAiClientOptions): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(options.apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(COMPLETIONS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  return response;
}

export async function completeChatCompletion(request: TwodbCompletionRequest, options: AzureOpenAiClientOptions): Promise<TwodbCompletionResponse> {
  const response = await post(buildUrl(options, request.model), buildBody(request, false), options);
  const payload = parseJson<AzureResponse>(await response.text());
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

export async function* streamChatCompletion(request: TwodbCompletionRequest, options: AzureOpenAiClientOptions): AsyncGenerator<TwodbStreamEvent> {
  const response = await post(buildUrl(options, request.model), buildBody(request, true), options);
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

        const chunk = parseJson<AzureStreamChunk>(data);
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
            const rawReasoning = delta.reasoning_content ?? delta.reasoning;
            const reasoning = typeof rawReasoning === "string" ? rawReasoning : undefined;
            const toolCalls = delta.tool_calls
              ? delta.tool_calls.map((call) => ({
                  index: call.index ?? index,
                  id: call.id ?? "",
                  type: "function" as const,
                  function: { name: call.function?.name ?? "", arguments: call.function?.arguments ?? "" },
                }))
              : undefined;
            if (content !== undefined || reasoning !== undefined || (toolCalls?.length ?? 0) > 0) {
              yield {
                type: "chunk",
                index,
                delta: {
                  ...(content !== undefined ? { content } : {}),
                  ...(reasoning !== undefined ? { reasoning } : {}),
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
