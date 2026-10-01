import type { LlmConnectionTable } from "../plugins/db";
import { getProvider, providerAuthHeaders, providerBaseUrl } from "./llm-providers";
import { ensureFreshTokens } from "./token-refresh";

// ---------------------------------------------------------------------------
// Agent layer — generic agent-completion interface every adapter implements.
// One round = one model call with tools available; rounds stream text deltas
// back through onDelta while the caller (agent loop) owns the tool decisions.
// ---------------------------------------------------------------------------

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentThinking {
  text: string;
  /** Anthropic signs thinking blocks; required when replaying them into history. */
  signature?: string;
}

/**
 * History entries understood by the agent layer. "assistant" entries may carry
 * toolCalls in meta; "tool" entries carry the result for meta.toolCallId.
 */
export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  meta?: {
    toolCalls?: AgentToolCall[];
    toolCallId?: string;
    name?: string;
    thinking?: AgentThinking[];
    stopped?: boolean;
  } | null;
}

export interface AgentRoundResult {
  content: string | null;
  toolCalls: AgentToolCall[];
  thinking?: AgentThinking[];
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
}

export type DeltaSink = (text: string) => void;

/** Reasoning effort level; "off" disables thinking where the provider allows it. */
export type ThinkingLevel = "off" | "low" | "medium" | "high";

/** Optional per-round extras: cancellation + reasoning/thinking stream. */
export interface RoundEvents {
  signal?: AbortSignal;
  thinkingLevel?: ThinkingLevel;
  onThinkingStart?: () => void;
  onThinkingDelta?: DeltaSink;
  onThinkingEnd?: () => void;
}

function safeJson(data: string): Record<string, unknown> | null {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Reads an SSE body and yields each `data:` payload string. */
async function* sseData(res: Response): AsyncGenerator<string> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

// --- Anthropic wire format --------------------------------------------------

function anthropicMessages(messages: AgentMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const out: unknown[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "assistant") {
      const blocks: unknown[] = [];
      // Signed thinking blocks must lead the assistant turn when tool_use
      // follows (Anthropic requirement); unsigned ones can't be replayed.
      for (const t of m.meta?.thinking ?? []) {
        if (t.signature) blocks.push({ type: "thinking", thinking: t.text, signature: t.signature });
      }
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.meta?.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      out.push(blocks.length ? { role: "assistant", content: blocks } : { role: "assistant", content: m.content });
    } else if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.meta?.toolCallId ?? "",
            content: m.content,
          },
        ],
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return { system, messages: out };
}

async function anthropicRound(
  connection: LlmConnectionTable,
  model: string,
  messages: AgentMessage[],
  tools: AgentTool[],
  onDelta: DeltaSink,
  events: RoundEvents,
): Promise<AgentRoundResult> {
  const provider = getProvider(connection.provider)!;
  const config = await ensureFreshTokens(connection);
  const baseUrl = providerBaseUrl(provider, config);
  const { system, messages: mapped } = anthropicMessages(messages);
  // Extended thinking exists on Claude 3.7+; older models reject the param.
  const supportsThinking = /claude-(?:3-7|[4-9])/.test(model);
  const budgetTokens = supportsThinking ? { off: 0, low: 1024, medium: 4096, high: 16384 }[events.thinkingLevel ?? "medium"] : 0;

  // OAuth (Claude Code subscription) requests must lead with the Claude Code
  // identity block or Anthropic bills them against API balance.
  const systemParam =
    provider.auth === "claude-oauth"
      ? [{ type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." }, ...(system ? [{ type: "text", text: system }] : [])]
      : system || undefined;

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      ...providerAuthHeaders(provider, config),
    },
    body: JSON.stringify({
      model,
      // max_tokens must exceed the thinking budget.
      max_tokens: budgetTokens >= 8192 ? budgetTokens * 2 : 8192,
      stream: true,
      ...(budgetTokens ? { thinking: { type: "enabled", budget_tokens: budgetTokens } } : {}),
      ...(systemParam ? { system: systemParam } : {}),
      messages: mapped,
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
            })),
          }
        : {}),
    }),
    signal: events.signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`provider returned ${res.status}: ${body.slice(0, 300)}`);
  }

  const blocks = new Map<number, { type: string; text: string; id: string; name: string; json: string; signature: string }>();
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  for await (const data of sseData(res)) {
    const evt = safeJson(data);
    if (!evt) continue;
    const type = String(evt.type ?? "");

    if (type === "message_start") {
      const u = ((evt.message as Record<string, unknown>)?.usage ?? {}) as {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
      // Anthropic reports cache tokens separately from input_tokens; fold
      // them in so inputTokens is the full context the model saw.
      usage.inputTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      usage.cachedTokens = u.cache_read_input_tokens ?? 0;
    } else if (type === "content_block_start") {
      const block = (evt.content_block ?? {}) as Record<string, unknown>;
      blocks.set(Number(evt.index), {
        type: String(block.type ?? "text"),
        text: typeof block.text === "string" ? block.text : "",
        id: String(block.id ?? ""),
        name: String(block.name ?? ""),
        json: "",
        signature: "",
      });
      if (block.type === "thinking") events.onThinkingStart?.();
    } else if (type === "content_block_delta") {
      const delta = (evt.delta ?? {}) as Record<string, unknown>;
      const block = blocks.get(Number(evt.index));
      if (!block) continue;
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        block.text += delta.text;
        onDelta(delta.text);
      } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        block.text += delta.thinking;
        events.onThinkingDelta?.(delta.thinking);
      } else if (delta.type === "signature_delta" && typeof delta.signature === "string") {
        block.signature += delta.signature;
      } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        block.json += delta.partial_json;
      }
    } else if (type === "content_block_stop") {
      if (blocks.get(Number(evt.index))?.type === "thinking") events.onThinkingEnd?.();
    } else if (type === "message_delta") {
      const u = (evt.usage ?? {}) as { output_tokens?: number };
      usage.outputTokens = u.output_tokens ?? usage.outputTokens;
    }
  }

  const ordered = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
  const text = ordered
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const toolCalls = ordered
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id,
      name: b.name,
      arguments: (b.json ? safeJson(b.json) : null) ?? {},
    }));
  const thinking = ordered.filter((b) => b.type === "thinking").map((b) => ({ text: b.text, ...(b.signature ? { signature: b.signature } : {}) }));
  return { content: text || null, toolCalls, usage, ...(thinking.length ? { thinking } : {}) };
}

// --- OpenAI wire format -----------------------------------------------------

function openaiMessages(messages: AgentMessage[]) {
  return messages.map((m) => {
    if (m.role === "assistant" && m.meta?.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.meta.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.meta?.toolCallId ?? "",
        content: m.content,
      };
    }
    return { role: m.role, content: m.content };
  });
}

async function openaiRound(
  connection: LlmConnectionTable,
  model: string,
  messages: AgentMessage[],
  tools: AgentTool[],
  onDelta: DeltaSink,
  events: RoundEvents,
): Promise<AgentRoundResult> {
  const provider = getProvider(connection.provider)!;
  const config = await ensureFreshTokens(connection);
  const baseUrl = providerBaseUrl(provider, config);
  const isZai = connection.provider === "zai";
  const thinkingLevel = events.thinkingLevel ?? "medium";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...providerAuthHeaders(provider, config),
    },
    body: JSON.stringify({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages: openaiMessages(messages),
      // z.ai: thinking is a plain on/off toggle and effort levels are not
      // tunable (mirrors pi's zai compat); tool_stream streams tool-call args.
      // Other openai-compatible reasoning models take reasoning_effort.
      ...(isZai
        ? {
            thinking: thinkingLevel === "off" ? { type: "disabled" } : { type: "enabled", clear_thinking: false },
            tool_stream: true,
          }
        : thinkingLevel !== "off"
          ? { reasoning_effort: thinkingLevel }
          : {}),
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
          }
        : {}),
    }),
    signal: events.signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`provider returned ${res.status}: ${body.slice(0, 300)}`);
  }

  const toolAcc = new Map<number, { id: string; name: string; json: string }>();
  let text = "";
  let reasoningText = "";
  let reasoningOpen = false;
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  for await (const data of sseData(res)) {
    if (data === "[DONE]") break;
    const chunk = safeJson(data);
    if (!chunk) continue;

    const u = (chunk.usage ?? null) as {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    } | null;
    if (u) {
      usage.inputTokens = u.prompt_tokens ?? usage.inputTokens;
      usage.outputTokens = u.completion_tokens ?? usage.outputTokens;
      usage.cachedTokens = u.prompt_tokens_details?.cached_tokens ?? 0;
    }

    const choice = (chunk.choices as Record<string, unknown>[] | undefined)?.[0];
    if (!choice) continue;
    const delta = (choice.delta ?? {}) as Record<string, unknown>;

    if (typeof delta.content === "string" && delta.content) {
      if (reasoningOpen) {
        reasoningOpen = false;
        events.onThinkingEnd?.();
      }
      text += delta.content;
      onDelta(delta.content);
    }
    // Reasoning models stream thinking under reasoning_content (OpenRouter,
    // DeepSeek) or reasoning on some providers.
    const reasoning = typeof delta.reasoning_content === "string" ? delta.reasoning_content : typeof delta.reasoning === "string" ? delta.reasoning : "";
    if (reasoning) {
      if (!reasoningOpen) {
        reasoningOpen = true;
        events.onThinkingStart?.();
      }
      reasoningText += reasoning;
      events.onThinkingDelta?.(reasoning);
    }
    for (const raw of Array.isArray(delta.tool_calls) ? (delta.tool_calls as Record<string, unknown>[]) : []) {
      const fn = (raw.function ?? {}) as { name?: string; arguments?: string };
      const entry = toolAcc.get(Number(raw.index)) ?? { id: "", name: "", json: "" };
      if (typeof raw.id === "string" && raw.id) entry.id = raw.id;
      if (fn.name) entry.name += fn.name;
      if (fn.arguments) entry.json += fn.arguments;
      toolAcc.set(Number(raw.index), entry);
    }
  }

  const toolCalls = [...toolAcc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, t]) => ({
      id: t.id,
      name: t.name,
      arguments: (t.json ? safeJson(t.json) : null) ?? {},
    }));
  if (reasoningOpen) events.onThinkingEnd?.();
  return { content: text || null, toolCalls, usage, ...(reasoningText ? { thinking: [{ text: reasoningText }] } : {}) };
}

// --- OpenAI Responses wire (Codex) ------------------------------------------

function responsesInput(messages: AgentMessage[]) {
  const instructions = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const input: unknown[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "assistant") {
      if (m.content) input.push({ role: "assistant", content: m.content });
      for (const tc of m.meta?.toolCalls ?? []) {
        input.push({
          type: "function_call",
          call_id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        });
      }
    } else if (m.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: m.meta?.toolCallId ?? "",
        output: m.content,
      });
    } else {
      input.push({ role: m.role, content: m.content });
    }
  }
  return { instructions, input };
}

async function responsesRound(
  connection: LlmConnectionTable,
  model: string,
  messages: AgentMessage[],
  tools: AgentTool[],
  onDelta: DeltaSink,
  events: RoundEvents,
): Promise<AgentRoundResult> {
  const provider = getProvider(connection.provider)!;
  const config = await ensureFreshTokens(connection);
  const baseUrl = providerBaseUrl(provider, config);
  const { instructions, input } = responsesInput(messages);

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "OpenAI-Beta": "responses=experimental",
      originator: "twodb",
      authorization: `Bearer ${config[provider.authKey ?? "access_token"] ?? ""}`,
      ...(config.account_id ? { "chatgpt-account-id": config.account_id } : {}),
    },
    body: JSON.stringify({
      model,
      stream: true,
      store: false,
      // chatgpt backend requires instructions + encrypted reasoning when store=false
      instructions: instructions || "You are a helpful assistant.",
      include: ["reasoning.encrypted_content"],
      reasoning: events.thinkingLevel === "off" ? { effort: "minimal" } : { effort: events.thinkingLevel ?? "medium", summary: "auto" },
      input,
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              type: "function",
              name: t.name,
              description: t.description,
              parameters: t.parameters,
              strict: false,
            })),
            tool_choice: "auto",
          }
        : {}),
    }),
    signal: events.signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`provider returned ${res.status}: ${body.slice(0, 300)}`);
  }

  let text = "";
  let reasoningText = "";
  let reasoningOpen = false;
  const toolCalls: AgentToolCall[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

  for await (const data of sseData(res)) {
    const evt = safeJson(data);
    if (!evt) continue;
    const type = String(evt.type ?? "");

    if (type === "response.output_text.delta" && typeof evt.delta === "string") {
      text += evt.delta;
      onDelta(evt.delta);
    } else if (type === "response.reasoning_summary_part.added") {
      reasoningOpen = true;
      events.onThinkingStart?.();
    } else if (type === "response.reasoning_summary_text.delta" && typeof evt.delta === "string") {
      if (!reasoningOpen) {
        reasoningOpen = true;
        events.onThinkingStart?.();
      }
      reasoningText += evt.delta;
      events.onThinkingDelta?.(evt.delta);
    } else if (type === "response.reasoning_summary_part.done") {
      if (reasoningOpen) {
        reasoningOpen = false;
        events.onThinkingEnd?.();
      }
    } else if (type === "response.output_item.done") {
      const item = (evt.item ?? {}) as Record<string, unknown>;
      if (item.type === "reasoning" && reasoningOpen) {
        reasoningOpen = false;
        events.onThinkingEnd?.();
      }
      if (item.type === "function_call") {
        toolCalls.push({
          id: String(item.call_id ?? ""),
          name: String(item.name ?? ""),
          arguments: (typeof item.arguments === "string" ? safeJson(item.arguments) : null) ?? {},
        });
      }
    } else if (type === "response.completed") {
      const response = (evt.response ?? {}) as Record<string, unknown>;
      const u = (response.usage ?? {}) as {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      };
      usage.inputTokens = u.input_tokens ?? usage.inputTokens;
      usage.outputTokens = u.output_tokens ?? usage.outputTokens;
      usage.cachedTokens = u.input_tokens_details?.cached_tokens ?? 0;
    } else if (type === "response.failed" || type === "error") {
      const err = (evt.error ?? evt.response ?? {}) as Record<string, unknown>;
      throw new Error(`responses stream failed: ${JSON.stringify(err).slice(0, 300)}`);
    }
  }

  if (reasoningOpen) events.onThinkingEnd?.();
  return { content: text || null, toolCalls, usage, ...(reasoningText ? { thinking: [{ text: reasoningText }] } : {}) };
}

/** Runs a single streaming agent-completion round against the connection's provider. */
export async function runAgentRound(
  connection: LlmConnectionTable,
  model: string,
  messages: AgentMessage[],
  tools: AgentTool[],
  onDelta: DeltaSink = () => {},
  events: RoundEvents = {},
): Promise<AgentRoundResult> {
  const provider = getProvider(connection.provider);
  if (provider?.api === "anthropic") {
    return anthropicRound(connection, model, messages, tools, onDelta, events);
  }
  if (provider?.api === "openai") {
    return openaiRound(connection, model, messages, tools, onDelta, events);
  }
  if (provider?.api === "responses") {
    return responsesRound(connection, model, messages, tools, onDelta, events);
  }
  throw new Error(`agent completions not supported for provider "${connection.provider}"`);
}
