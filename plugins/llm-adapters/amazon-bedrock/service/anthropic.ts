import type {
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbFinishReason,
  TwodbMessage,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolChoice,
  TwodbUsage,
} from "@twodb/contracts";
import type { AnthropicStreamEvent } from "./bedrock-client";

const ANTHROPIC_BEDROCK_VERSION = "bedrock-2023-05-31";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContentBlock[] };

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: object;
};

type AnthropicThinkingConfig = {
  type: "enabled";
  budget_tokens: number;
};

type AnthropicToolChoice = { type: "auto" | "any" } | { type: "tool"; name: string };

export type AnthropicMessagesRequest = {
  anthropic_version: string;
  model: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  thinking?: AnthropicThinkingConfig;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
};

export type AnthropicMessagesResponse = {
  id?: string;
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseJsonRecord(json: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(json || "{}")) ?? {};
  } catch {
    return {};
  }
}

function toAnthropicMessages(messages: TwodbMessage[]): { system: string | undefined; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  const pushBlock = (role: "user" | "assistant", block: AnthropicContentBlock): void => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };

  for (const message of messages) {
    switch (message.role) {
      case "system":
        systemParts.push(message.content);
        break;
      case "user":
        for (const part of Array.isArray(message.content) ? message.content : [{ type: "text" as const, text: message.content }]) {
          if (part.type === "text") pushBlock("user", { type: "text", text: part.text });
        }
        break;
      case "assistant":
        if (message.content) pushBlock("assistant", { type: "text", text: message.content });
        for (const call of message.tool_calls ?? []) {
          pushBlock("assistant", {
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input: parseJsonRecord(call.function.arguments),
          });
        }
        break;
      case "tool":
        pushBlock("user", {
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: message.content,
        });
        break;
    }
  }

  if (!out.length) out.push({ role: "user", content: [{ type: "text", text: "" }] });
  return { system: systemParts.length ? systemParts.join("\n\n") : undefined, messages: out };
}

function toAnthropicTools(tools: TwodbTool[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "No description provided",
    input_schema: tool.function.parameters,
  }));
}

function toAnthropicToolChoice(choice: TwodbToolChoice): AnthropicToolChoice {
  if (choice === "required") return { type: "any" };
  if (typeof choice === "object") return { type: "tool", name: choice.function.name };
  return { type: "auto" };
}

function toThinkingConfig(request: TwodbCompletionRequest, maxTokens: number): AnthropicThinkingConfig | undefined {
  const level = request.thinking?.level;
  if (!level || level === "off") return undefined;
  const fraction = level === "low" ? 0.25 : level === "medium" ? 0.5 : 0.75;
  const budget = request.thinking?.budget_tokens ?? Math.max(1024, Math.floor(maxTokens * fraction));
  return {
    type: "enabled",
    budget_tokens: Math.max(1024, Math.min(budget, Math.max(1024, maxTokens - 1024))),
  };
}

export function toBedrockAnthropicRequest(request: TwodbCompletionRequest, defaultMaxTokens: number): AnthropicMessagesRequest {
  const maxTokens = request.max_tokens ?? defaultMaxTokens;
  const tools = request.tool_choice === "none" ? undefined : request.tools;
  const thinking = toThinkingConfig(request, maxTokens);
  const { system, messages } = toAnthropicMessages(request.messages);
  return {
    anthropic_version: ANTHROPIC_BEDROCK_VERSION,
    model: request.model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
    ...(tools?.length
      ? {
          tools: toAnthropicTools(tools),
          ...(request.tool_choice && request.tool_choice !== "none" ? { tool_choice: toAnthropicToolChoice(request.tool_choice) } : {}),
        }
      : {}),
    ...(thinking ? { thinking } : {}),
    ...(!thinking && request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(!thinking && request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.stop?.length ? { stop_sequences: request.stop } : {}),
  };
}

export function toTwodbResponse(request: TwodbCompletionRequest, response: AnthropicMessagesResponse): TwodbCompletionResponse {
  const blocks = Array.isArray(response.content) ? response.content : [];
  let text = "";
  const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  for (const block of blocks) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }
  return {
    id: response.id ?? `msg-${crypto.randomUUID()}`,
    model: response.model ?? request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toFinishReason(response.stop_reason),
      },
    ],
    ...(toUsage(response.usage) ? { usage: toUsage(response.usage) } : {}),
  };
}

function toFinishReason(stopReason: string | null | undefined): TwodbFinishReason {
  switch (stopReason) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "stop";
  }
}

function usageNumber(usage: Record<string, unknown> | undefined, key: string): number {
  const value = usage?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toUsage(usage: Record<string, unknown> | undefined): TwodbUsage | undefined {
  if (!usage) return undefined;
  return {
    input_tokens: usageNumber(usage, "input_tokens"),
    output_tokens: usageNumber(usage, "output_tokens"),
    ...(usageNumber(usage, "cache_read_input_tokens") ? { cached_input_tokens: usageNumber(usage, "cache_read_input_tokens") } : {}),
  };
}

type StreamBlock = { type: string; id: string; name: string; toolIndex: number };

export async function* mapAnthropicStream(events: AsyncIterable<AnthropicStreamEvent>, fallbackModel: string): AsyncGenerator<TwodbStreamEvent> {
  const blocks = new Map<number, StreamBlock>();
  let toolCount = 0;
  let stopReason: string | null = null;
  let inputUsage: Record<string, unknown> | undefined;
  let outputTokens = 0;

  for await (const event of events) {
    switch (event.type) {
      case "message_start":
        inputUsage = event.message.usage;
        yield { type: "start", id: event.message.id ?? `msg-${crypto.randomUUID()}`, model: event.message.model ?? fallbackModel };
        break;
      case "content_block_start": {
        const block = event.content_block;
        const type = String(block["type"] ?? "text");
        blocks.set(event.index, {
          type,
          id: String(block["id"] ?? ""),
          name: String(block["name"] ?? ""),
          toolIndex: type === "tool_use" ? toolCount++ : -1,
        });
        break;
      }
      case "content_block_delta": {
        const delta = event.delta;
        const block = blocks.get(event.index);
        if (delta["type"] === "text_delta") {
          yield { type: "chunk", index: 0, delta: { content: String(delta["text"] ?? "") } };
        } else if (delta["type"] === "thinking_delta") {
          yield { type: "chunk", index: 0, delta: { reasoning: String(delta["thinking"] ?? "") } };
        } else if (delta["type"] === "input_json_delta" && block) {
          yield {
            type: "chunk",
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: block.toolIndex,
                  id: block.id,
                  type: "function",
                  function: { name: block.name, arguments: String(delta["partial_json"] ?? "") },
                },
              ],
            },
          };
        }
        break;
      }
      case "message_delta":
        stopReason = event.delta.stop_reason ?? stopReason;
        if (typeof event.usage?.output_tokens === "number") {
          outputTokens = event.usage.output_tokens;
        }
        break;
      case "message_stop": {
        yield { type: "finish", index: 0, finish_reason: toFinishReason(stopReason) };
        const usage = toUsage(inputUsage);
        if (usage) {
          yield { type: "usage", usage: { ...usage, output_tokens: outputTokens } };
        }
        return;
      }
      case "error":
        yield { type: "error", error: String(event.error.message ?? "stream failed") };
        return;
    }
  }
  yield { type: "error", error: "stream ended without message_stop" };
}
