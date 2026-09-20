import type {
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbContentPart,
  TwodbFinishReason,
  TwodbMessage,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolChoice,
  TwodbUsage,
} from "@twodb/contracts";

const REQUEST_TIMEOUT_MS = 120_000;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const THINKING_BUDGETS: Record<"low" | "medium" | "high", number> = { low: 8192, medium: 16384, high: 32768 };

export type GeminiClientOptions = {
  baseUrl: string;
  apiKey: string;
  modelMaxOutputTokens?: number;
};

type GeminiPart = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
  fileData?: { fileUri: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

type GeminiFunctionDeclaration = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

type GeminiRequestBody = {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  tools?: Array<{ functionDeclarations: GeminiFunctionDeclaration[] }>;
  toolConfig?: { functionCallingConfig: { mode: string; allowedFunctionNames?: string[] } };
  generationConfig: Record<string, unknown>;
};

type GeminiCandidate = {
  index?: number;
  content?: { role?: string; parts?: GeminiPart[] };
  finishReason?: string | null;
};

type GeminiResponsePayload = {
  responseId?: string;
  modelVersion?: string;
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
};

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

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

function dataUriPart(url: string, fallbackMimeType: string): GeminiPart {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) return { fileData: { fileUri: url } };
  const data = match[2] ? match[3] : Buffer.from(decodeURIComponent(match[3]), "utf8").toString("base64");
  return { inlineData: { mimeType: match[1] || fallbackMimeType, data } };
}

function toPart(part: TwodbContentPart): GeminiPart {
  if (part.type === "text") return { text: part.text };
  if (part.type === "image") return dataUriPart(part.url, "image/png");
  return dataUriPart(part.url, part.format ?? "audio/wav");
}

function toContentsAndSystem(messages: TwodbMessage[]): { system: string; contents: GeminiContent[] } {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];
  const toolNames = new Map<string, string>();

  const push = (role: "user" | "model", part: GeminiPart): void => {
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(part);
    else contents.push({ role, parts: [part] });
  };

  for (const message of messages) {
    switch (message.role) {
      case "system":
        systemParts.push(message.content);
        break;
      case "user": {
        const parts = Array.isArray(message.content) ? message.content.map(toPart) : [{ text: message.content }];
        for (const part of parts) push("user", part);
        break;
      }
      case "assistant":
        if (message.content) push("model", { text: message.content });
        for (const call of message.tool_calls ?? []) {
          toolNames.set(call.id, call.function.name);
          push("model", {
            functionCall: { name: call.function.name, args: parseJsonRecord(call.function.arguments) },
          });
        }
        break;
      case "tool": {
        const parsed = parseJsonRecord(message.content);
        push("user", {
          functionResponse: {
            name: message.name ?? toolNames.get(message.tool_call_id) ?? message.tool_call_id,
            response: Object.keys(parsed).length ? parsed : { result: message.content },
          },
        });
        break;
      }
    }
  }

  if (!contents.length) contents.push({ role: "user", parts: [{ text: "" }] });
  return { system: systemParts.join("\n\n"), contents };
}

function toGeminiTools(tools: TwodbTool[]): Array<{ functionDeclarations: GeminiFunctionDeclaration[] }> {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.function.name,
        ...(tool.function.description ? { description: tool.function.description } : {}),
        parameters: tool.function.parameters,
      })),
    },
  ];
}

function toToolConfig(choice: TwodbToolChoice | undefined): GeminiRequestBody["toolConfig"] {
  if (choice === undefined || choice === "auto") return undefined;
  if (choice === "none") return { functionCallingConfig: { mode: "NONE" } };
  if (choice === "required") return { functionCallingConfig: { mode: "ANY" } };
  return { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [choice.function.name] } };
}

function toThinkingBudget(request: TwodbCompletionRequest, cap: number): number | undefined {
  const level = request.thinking?.level;
  if (level === undefined) return undefined;
  if (level === "off") return 0;
  const budget = request.thinking?.budget_tokens ?? THINKING_BUDGETS[level];
  return Math.max(1, Math.min(budget, cap));
}

function toRequestBody(request: TwodbCompletionRequest, options: GeminiClientOptions): GeminiRequestBody {
  const { system, contents } = toContentsAndSystem(request.messages);
  const thinkingBudget = toThinkingBudget(request, options.modelMaxOutputTokens ?? 32768);
  const responseFormat = request.response_format;
  const body: GeminiRequestBody = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.top_p !== undefined ? { topP: request.top_p } : {}),
      ...(request.max_tokens !== undefined ? { maxOutputTokens: request.max_tokens } : {}),
      ...(request.stop?.length ? { stopSequences: request.stop } : {}),
      ...(responseFormat?.type === "json_object" || responseFormat?.type === "json_schema"
        ? {
            responseMimeType: "application/json",
            ...(responseFormat.json_schema ? { responseSchema: responseFormat.json_schema.schema } : {}),
          }
        : {}),
      ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
    },
  };
  if (request.tools?.length) {
    body.tools = toGeminiTools(request.tools);
    const toolConfig = toToolConfig(request.tool_choice);
    if (toolConfig) body.toolConfig = toolConfig;
  }
  return body;
}

function toFinishReason(reason: string | null | undefined): TwodbFinishReason {
  switch (reason) {
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "content_filter";
    case "MALFORMED_FUNCTION_CALL":
    case "ERROR":
      return "error";
    default:
      return "stop";
  }
}

function mapUsage(metadata: GeminiResponsePayload["usageMetadata"]): TwodbUsage | undefined {
  if (!metadata || typeof metadata.promptTokenCount !== "number" || typeof metadata.candidatesTokenCount !== "number") {
    return undefined;
  }
  const thoughts = typeof metadata.thoughtsTokenCount === "number" ? metadata.thoughtsTokenCount : 0;
  const cached = typeof metadata.cachedContentTokenCount === "number" ? metadata.cachedContentTokenCount : 0;
  return {
    input_tokens: metadata.promptTokenCount,
    output_tokens: metadata.candidatesTokenCount + thoughts,
    ...(thoughts ? { reasoning_tokens: thoughts } : {}),
    ...(cached ? { cached_input_tokens: cached } : {}),
  };
}

function firstCandidate(payload: GeminiResponsePayload): GeminiCandidate | undefined {
  return payload.candidates?.find((entry) => (entry.index ?? 0) === 0) ?? payload.candidates?.[0];
}

function toolCallsOf(parts: GeminiPart[]): Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> {
  const calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
  for (let index = 0; index < parts.length; index++) {
    const call = parts[index].functionCall;
    if (call) {
      calls.push({
        id: `call_${index}`,
        type: "function",
        function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
      });
    }
  }
  return calls;
}

function toTwodbResponse(request: TwodbCompletionRequest, payload: GeminiResponsePayload): TwodbCompletionResponse {
  const candidate = firstCandidate(payload);
  const parts = candidate?.content?.parts ?? [];
  let text = "";
  for (const part of parts) {
    if (typeof part.text === "string" && !part.thought) text += part.text;
  }
  const toolCalls = toolCallsOf(parts);
  const usage = mapUsage(payload.usageMetadata);
  const blockReason = payload.promptFeedback?.blockReason ?? candidate?.finishReason;
  return {
    id: payload.responseId ?? `gem-${crypto.randomUUID()}`,
    model: payload.modelVersion ?? request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as const,
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toolCalls.length ? "tool_calls" : toFinishReason(blockReason),
      },
    ],
    ...(usage ? { usage } : {}),
  };
}

function parsePayload(text: string): GeminiResponsePayload {
  try {
    const parsed: unknown = JSON.parse(text);
    return asRecord(parsed) ?? {};
  } catch {
    throw new Error(`invalid JSON response: ${sanitizeError(text)}`);
  }
}

function requestHeaders(apiKey: string): Record<string, string> {
  return { "content-type": "application/json", "x-goog-api-key": apiKey };
}

function modelUrl(baseUrl: string, model: string, stream: boolean): string {
  if (!MODEL_ID_PATTERN.test(model)) throw new Error(`invalid model id: ${model}`);
  const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return `${baseUrl.replace(/\/+$/, "")}/models/${model}:${action}`;
}

export async function completeGenerateContent(request: TwodbCompletionRequest, options: GeminiClientOptions): Promise<TwodbCompletionResponse> {
  const endpoint = modelUrl(options.baseUrl, request.model, false);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders(options.apiKey),
    body: JSON.stringify(toRequestBody(request, options)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${sanitizeError(text)}`);
  return toTwodbResponse(request, parsePayload(text));
}

export async function* streamGenerateContent(request: TwodbCompletionRequest, options: GeminiClientOptions): AsyncGenerator<TwodbStreamEvent> {
  const endpoint = modelUrl(options.baseUrl, request.model, true);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders(options.apiKey),
    body: JSON.stringify(toRequestBody(request, options)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  if (!response.body) throw new Error("Gemini API returned an empty response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  let toolCount = 0;

  function* handlePayload(payloadText: string): Generator<TwodbStreamEvent> {
    const payload = parsePayload(payloadText);
    if (!started) {
      started = true;
      yield { type: "start", id: payload.responseId ?? "", model: payload.modelVersion ?? request.model };
    }
    const usage = mapUsage(payload.usageMetadata);
    if (usage) yield { type: "usage", usage };

    const candidate = firstCandidate(payload);
    for (const part of candidate?.content?.parts ?? []) {
      if (part.functionCall) {
        const index = toolCount++;
        yield {
          type: "chunk",
          index: 0,
          delta: {
            tool_calls: [
              {
                index,
                id: `call_${index}`,
                type: "function",
                function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
              },
            ],
          },
        };
      } else if (typeof part.text === "string" && part.text) {
        yield {
          type: "chunk",
          index: 0,
          delta: part.thought ? { reasoning: part.text } : { content: part.text },
        };
      }
    }
    if (candidate?.finishReason) {
      yield { type: "finish", index: 0, finish_reason: toFinishReason(candidate.finishReason) };
    }
    if (payload.promptFeedback?.blockReason) {
      yield { type: "finish", index: 0, finish_reason: toFinishReason(payload.promptFeedback.blockReason) };
    }
  }

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
        yield* handlePayload(data);
      }
    }
  }
}
