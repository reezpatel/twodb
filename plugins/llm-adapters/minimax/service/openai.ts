export type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export interface OpenAiChatRequest {
  model: string;
  messages: OpenAiMessage[];
  tools?: OpenAiTool[];
  tool_choice?: unknown;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
}

export type OpenAiChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: Record<string, unknown>;
    finish_reason?: string | null;
  }>;
  usage?: Record<string, unknown>;
};

export type OpenAiChatChunk = {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: Record<string, unknown>;
    finish_reason?: string | null;
  }>;
  usage?: Record<string, unknown>;
};

export const REQUEST_TIMEOUT_MS = 30_000;

export function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function requestBody(request: OpenAiChatRequest, stream: boolean): Record<string, unknown> {
  return {
    model: request.model,
    messages: request.messages,
    ...(request.tools?.length
      ? {
          tools: request.tools,
          ...(request.tool_choice !== undefined ? { tool_choice: request.tool_choice } : {}),
        }
      : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.max_tokens !== undefined ? { max_tokens: request.max_tokens } : {}),
    ...(request.stop?.length ? { stop: request.stop } : {}),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
  };
}

function requestHeaders(apiKey: string, stream: boolean): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    accept: stream ? "text/event-stream" : "application/json",
  };
}

export async function postChatCompletion(url: string, apiKey: string, request: OpenAiChatRequest): Promise<OpenAiChatResponse> {
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
    return parsed && typeof parsed === "object" ? (parsed as OpenAiChatResponse) : {};
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

export async function* streamChatCompletion(url: string, apiKey: string, request: OpenAiChatRequest): AsyncGenerator<OpenAiChatChunk> {
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
      if (data === "[DONE]") return;

      let parsed: OpenAiChatChunk;
      try {
        parsed = JSON.parse(data) as OpenAiChatChunk;
      } catch {
        throw new Error(`Invalid SSE payload: ${sanitizeError(data)}`);
      }
      yield parsed;
    }
  }
}
