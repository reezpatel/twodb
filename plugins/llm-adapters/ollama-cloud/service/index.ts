import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type {
  TwodbAdapterContext,
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbContentPart,
  TwodbFinishReason,
  TwodbLlmProviderAdapter,
  TwodbModelInfo,
  TwodbStreamDelta,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolCall,
  TwodbToolChoice,
  TwodbUsage,
} from "@twodb/contracts";

const CHAT_COMPLETIONS_URL = "https://ollama.com/v1/chat/completions";
const COMPLETE_TIMEOUT_MS = 120_000;
const STREAM_TIMEOUT_MS = 600_000;

const MODELS: TwodbModelInfo[] = [
  {
    id: "gpt-oss:120b",
    display_name: "GPT-OSS 120B",
    context_window: 131000,
    max_output_tokens: 32000,
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-08",
  },
  {
    id: "qwen3-coder:480b",
    display_name: "Qwen3 Coder 480B",
    context_window: 256000,
    max_output_tokens: 32000,
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-07",
  },
  {
    id: "deepseek-v3.1:671b",
    display_name: "DeepSeek V3.1 671B",
    context_window: 164000,
    max_output_tokens: 32000,
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-08",
  },
];

type WireContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: string } };

type WireToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type WireMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | WireContentPart[] | null;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
};

type WireRequest = {
  model: string;
  messages: WireMessage[];
  tools?: Array<{ type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } }>;
  tool_choice?: TwodbToolChoice;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: { type: string; json_schema?: { name: string; schema: Record<string, unknown> } };
  stop?: string[];
  stream: boolean;
};

type WireStreamChunk = {
  id?: string;
  model?: string;
  usage?: unknown;
  choices?: Array<{
    delta?: {
      content?: unknown;
      reasoning?: unknown;
      reasoning_content?: unknown;
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
    };
    finish_reason?: string | null;
  }>;
};

type WireCompletion = {
  id?: string;
  model?: string;
  usage?: unknown;
  choices?: Array<{
    message?: { content?: unknown; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason?: string | null;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function toFinishReason(reason: string | null | undefined): TwodbFinishReason {
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

function toUsage(raw: unknown): TwodbUsage | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;
  const input = numberField(record, "prompt_tokens");
  const output = numberField(record, "completion_tokens");
  if (input === undefined && output === undefined) return undefined;
  const completionDetails = asRecord(record["completion_tokens_details"]);
  const promptDetails = asRecord(record["prompt_tokens_details"]);
  const reasoning = completionDetails ? numberField(completionDetails, "reasoning_tokens") : undefined;
  const cached = promptDetails ? numberField(promptDetails, "cached_tokens") : undefined;
  return {
    input_tokens: input ?? 0,
    output_tokens: output ?? 0,
    ...(reasoning !== undefined ? { reasoning_tokens: reasoning } : {}),
    ...(cached !== undefined ? { cached_input_tokens: cached } : {}),
  };
}

function toWireContent(content: string | TwodbContentPart[]): string | WireContentPart[] {
  if (typeof content === "string") return content;
  const parts: WireContentPart[] = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ type: "text", text: part.text });
    } else if (part.type === "image") {
      parts.push({ type: "image_url", image_url: { url: part.url, ...(part.detail ? { detail: part.detail } : {}) } });
    }
  }
  return parts;
}

function toWireToolCalls(toolCalls: TwodbToolCall[]): WireToolCall[] {
  return toolCalls.map((call) => ({
    id: call.id,
    type: "function" as const,
    function: { name: call.function.name, arguments: call.function.arguments },
  }));
}

function toWireMessages(messages: TwodbCompletionRequest["messages"]): WireMessage[] {
  const out: WireMessage[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
        out.push({ role: "system", content: message.content });
        break;
      case "user":
        out.push({ role: "user", content: toWireContent(message.content) });
        break;
      case "assistant":
        out.push({
          role: "assistant",
          content: message.content,
          ...(message.tool_calls?.length ? { tool_calls: toWireToolCalls(message.tool_calls) } : {}),
        });
        break;
      case "tool":
        out.push({ role: "tool", tool_call_id: message.tool_call_id, content: message.content });
        break;
    }
  }
  return out;
}

function toWireRequest(request: TwodbCompletionRequest, stream: boolean): WireRequest {
  const wire: WireRequest = {
    model: request.model,
    messages: toWireMessages(request.messages),
    stream,
  };
  if (request.tools?.length) {
    wire.tools = request.tools.map((tool: TwodbTool) => ({
      type: "function",
      function: {
        name: tool.function.name,
        ...(tool.function.description ? { description: tool.function.description } : {}),
        parameters: tool.function.parameters,
      },
    }));
    if (request.tool_choice !== undefined) wire.tool_choice = request.tool_choice;
  }
  if (request.temperature !== undefined) wire.temperature = request.temperature;
  if (request.top_p !== undefined) wire.top_p = request.top_p;
  if (request.max_tokens !== undefined) wire.max_tokens = request.max_tokens;
  if (request.response_format) {
    const schema = request.response_format.json_schema;
    wire.response_format =
      request.response_format.type === "json_schema" && schema
        ? { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema } }
        : { type: request.response_format.type };
  }
  if (request.stop?.length) wire.stop = request.stop;
  return wire;
}

function bearerToken(ctx: TwodbAdapterContext): string {
  const value = ctx.config["session_cookie"];
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) throw new Error("ollama-cloud connection is missing session_cookie");
  return token;
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

async function postChat(ctx: TwodbAdapterContext, request: TwodbCompletionRequest, stream: boolean): Promise<Response> {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken(ctx)}`,
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(toWireRequest(request, stream)),
    signal: AbortSignal.timeout(stream ? STREAM_TIMEOUT_MS : COMPLETE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ollama-cloud chat error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  if (!response.body) {
    throw new Error("ollama-cloud chat returned an empty response body");
  }
  return response;
}

async function complete(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  const response = await postChat(ctx, request, false);
  const payload = parseJson<WireCompletion>(await response.text(), "ollama-cloud chat");
  const choice = payload.choices?.[0];
  if (!choice) throw new Error("ollama-cloud chat response has no choices");

  const toolCalls: TwodbToolCall[] = (choice.message?.tool_calls ?? [])
    .filter((call) => call.function?.name)
    .map((call) => ({
      id: call.id ?? "",
      type: "function" as const,
      function: { name: call.function?.name ?? "", arguments: call.function?.arguments ?? "" },
    }));
  const content = typeof choice.message?.content === "string" ? choice.message.content : null;
  const usage = toUsage(payload.usage);

  return {
    id: payload.id ?? crypto.randomUUID(),
    model: payload.model ?? request.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason: toFinishReason(choice.finish_reason),
      },
    ],
    ...(usage ? { usage } : {}),
  };
}

function chunkDelta(delta: NonNullable<NonNullable<WireStreamChunk["choices"]>[number]["delta"]>): TwodbStreamDelta | null {
  const content = typeof delta.content === "string" ? delta.content : undefined;
  const reasoningRaw = delta.reasoning ?? delta.reasoning_content;
  const reasoning = typeof reasoningRaw === "string" ? reasoningRaw : undefined;
  const toolCalls = (delta.tool_calls ?? [])
    .map((call) => ({
      index: call.index ?? 0,
      id: call.id ?? "",
      type: "function" as const,
      function: { name: call.function?.name ?? "", arguments: call.function?.arguments ?? "" },
    }))
    .filter((call) => call.function.name !== "" || call.function.arguments !== "");
  if (content === undefined && reasoning === undefined && !toolCalls.length) return null;
  return {
    ...(content !== undefined ? { content } : {}),
    ...(reasoning !== undefined ? { reasoning } : {}),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
}

async function* stream(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncIterable<TwodbStreamEvent> {
  const response = await postChat(ctx, request, true);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;

  const eventsFor = (rawEvent: string): TwodbStreamEvent[] | "done" => {
    const data = rawEvent
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return [];
    if (data === "[DONE]") return "done";

    const payload = parseJson<WireStreamChunk>(data, "ollama-cloud stream");
    const events: TwodbStreamEvent[] = [];
    if (!started) {
      started = true;
      events.push({ type: "start", id: payload.id ?? crypto.randomUUID(), model: payload.model ?? request.model });
    }
    const usage = toUsage(payload.usage);
    if (usage) events.push({ type: "usage", usage });
    const choice = payload.choices?.[0];
    if (choice) {
      const delta = choice.delta ? chunkDelta(choice.delta) : null;
      if (delta) events.push({ type: "chunk", index: 0, delta });
      if (choice.finish_reason) events.push({ type: "finish", index: 0, finish_reason: toFinishReason(choice.finish_reason) });
    }
    return events;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = /\r?\n\r?\n/.exec(buffer);
    while (boundary !== null) {
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = /\r?\n\r?\n/.exec(buffer);
      const events = eventsFor(rawEvent);
      if (events === "done") return;
      for (const event of events) yield event;
    }
  }

  if (buffer.trim()) {
    const events = eventsFor(buffer);
    if (events === "done") return;
    for (const event of events) yield event;
  }
}

const OllamaCloudAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.ollama-cloud",
  displayName: "Ollama Cloud",
  models: MODELS,
  tools: {
    runToolRound: async (request, ctx) => {
      const response = await complete(request, ctx);
      const choice = response.choices[0];
      return {
        tool_calls: choice.message.tool_calls ?? [],
        content: choice.message.content,
        ...(response.usage ? { usage: response.usage } : {}),
      };
    },
  },
  completions: {
    complete,
    stream,
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: async (): Promise<never> => {
      throw new Error("not_implemented — ollama-cloud has no documented usage API (quota percentages render only in the ollama.com settings page HTML)");
    },
  },
};

const OllamaCloudServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", OllamaCloudAdapter);
  },
} satisfies ServicePlugin;

export default OllamaCloudServicePlugin;
