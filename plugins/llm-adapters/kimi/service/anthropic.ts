export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: object;
};

export type AnthropicThinkingConfig = {
  type: "enabled";
  budget_tokens: number;
};

export type AnthropicToolChoice = { type: "auto" | "any" } | { type: "tool"; name: string };

export interface AnthropicMessagesRequest {
  model: string;
  maxTokens: number;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  thinking?: AnthropicThinkingConfig;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
}

export type AnthropicMessagesResponse = {
  id?: string;
  model?: string;
  content?: Record<string, unknown>[];
  stop_reason?: string | null;
  usage?: Record<string, unknown>;
};

export type AnthropicStreamEvent =
  | {
      type: "message_start";
      message: { id?: string; usage?: Record<string, unknown> };
    }
  | {
      type: "content_block_start";
      index: number;
      content_block: Record<string, unknown>;
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: Record<string, unknown>;
    }
  | { type: "content_block_stop"; index: number }
  | {
      type: "message_delta";
      delta: { stop_reason?: string | null };
      usage?: { output_tokens?: number };
    }
  | { type: "message_stop" }
  | { type: "ping" }
  | { type: "error"; error: { type?: string; message?: string } };

export const REQUEST_TIMEOUT_MS = 30_000;

export function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function requestBody(request: AnthropicMessagesRequest, stream: boolean): Record<string, unknown> {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    ...(stream ? { stream: true } : {}),
    ...(request.system ? { system: request.system } : {}),
    messages: request.messages,
    ...(request.tools?.length
      ? {
          tools: request.tools,
          ...(request.tool_choice ? { tool_choice: request.tool_choice } : {}),
        }
      : {}),
    ...(request.thinking ? { thinking: request.thinking } : {}),
    ...(!request.thinking && request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(!request.thinking && request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.stop_sequences?.length ? { stop_sequences: request.stop_sequences } : {}),
  };
}

function requestHeaders(apiKey: string, stream: boolean): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    accept: stream ? "text/event-stream" : "application/json",
  };
}

export async function postAnthropicMessages(url: string, apiKey: string, request: AnthropicMessagesRequest): Promise<AnthropicMessagesResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: requestHeaders(apiKey, false),
    body: JSON.stringify(requestBody(request, false)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${sanitizeError(text)}`);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as AnthropicMessagesResponse) : {};
  } catch {
    throw new Error("API returned invalid JSON");
  }
}

function eventData(rawEvent: string): string | null {
  const parts: string[] = [];
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.replace(/\r$/, "");
    if (trimmed.startsWith("data:")) parts.push(trimmed.slice(5).trimStart());
  }
  return parts.length ? parts.join("\n") : null;
}

export async function* streamAnthropicMessages(url: string, apiKey: string, request: AnthropicMessagesRequest): AsyncGenerator<AnthropicStreamEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: requestHeaders(apiKey, true),
    body: JSON.stringify(requestBody(request, true)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  if (!response.body) {
    throw new Error("API returned an empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = /\r?\n\r?\n/.exec(buffer);
    while (boundary !== null) {
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = /\r?\n\r?\n/.exec(buffer);

      const data = eventData(rawEvent);
      if (!data) continue;

      let parsed: AnthropicStreamEvent;
      try {
        parsed = JSON.parse(data) as AnthropicStreamEvent;
      } catch {
        throw new Error(`Invalid SSE payload: ${sanitizeError(data)}`);
      }
      yield parsed;
    }
  }
}
