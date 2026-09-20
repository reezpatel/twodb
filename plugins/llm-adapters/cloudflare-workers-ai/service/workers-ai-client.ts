import type { TwodbCompletionRequest, TwodbCompletionResponse, TwodbStreamEvent, TwodbUsage } from "@twodb/contracts";

export type WorkersAiClientOptions = {
  accountId: string;
  apiToken: string;
};

const COMPLETIONS_TIMEOUT_MS = 120_000;

type WorkersAiMessage = { role: "system" | "user" | "assistant"; content: string };

type WorkersAiRequestBody = {
  messages: WorkersAiMessage[];
  stream: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
};

type WorkersAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

type WorkersAiResult = {
  id?: string;
  response?: string;
  usage?: WorkersAiUsage;
};

type WorkersAiEnvelope = {
  result?: WorkersAiResult;
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

type WorkersAiResponse = WorkersAiResult & Partial<WorkersAiEnvelope>;

type WorkersAiStreamChunk = {
  id?: string;
  response?: string;
  usage?: WorkersAiUsage;
};

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function buildUrl(options: WorkersAiClientOptions, model: string): string {
  const modelPath = model.startsWith("@") ? model : `@cf/${model}`;
  const account = encodeURIComponent(options.accountId.trim());
  return `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${modelPath}`;
}

function toWorkersAiMessage(message: TwodbCompletionRequest["messages"][number]): WorkersAiMessage {
  if (message.role === "system") return { role: "system", content: message.content };
  if (message.role === "assistant") return { role: "assistant", content: message.content ?? "" };
  if (message.role === "tool") return { role: "user", content: message.content };
  return {
    role: "user",
    content: typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(""),
  };
}

function buildBody(request: TwodbCompletionRequest, stream: boolean): WorkersAiRequestBody {
  return {
    messages: request.messages.map(toWorkersAiMessage),
    stream,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.max_tokens !== undefined ? { max_tokens: request.max_tokens } : {}),
  };
}

function mapUsage(usage: WorkersAiUsage | null | undefined): TwodbUsage | undefined {
  if (!usage || typeof usage.prompt_tokens !== "number" || typeof usage.completion_tokens !== "number") {
    return undefined;
  }
  return { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`invalid JSON response: ${sanitizeError(text)}`);
  }
}

async function post(url: string, body: WorkersAiRequestBody, options: WorkersAiClientOptions): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${options.apiToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(COMPLETIONS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  return response;
}

export async function completeWorkersAi(request: TwodbCompletionRequest, options: WorkersAiClientOptions): Promise<TwodbCompletionResponse> {
  const response = await post(buildUrl(options, request.model), buildBody(request, false), options);
  const payload = parseJson<WorkersAiResponse>(await response.text());
  if (payload.success === false) {
    const errors = payload.errors
      ?.map((error) => error.message ?? "")
      .filter(Boolean)
      .join("; ");
    throw new Error(`API error: ${errors || "request failed"}`);
  }
  const result: WorkersAiResult = payload.result ?? {
    id: payload.id,
    response: payload.response,
    usage: payload.usage,
  };
  return {
    id: result.id ?? "",
    model: request.model,
    choices: [{ index: 0, message: { role: "assistant", content: result.response ?? "" }, finish_reason: "stop" }],
    ...(mapUsage(result.usage) ? { usage: mapUsage(result.usage) } : {}),
  };
}

export async function* streamWorkersAi(request: TwodbCompletionRequest, options: WorkersAiClientOptions): AsyncGenerator<TwodbStreamEvent> {
  const response = await post(buildUrl(options, request.model), buildBody(request, true), options);
  if (!response.body) throw new Error("API returned an empty response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  let id = "";

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
        if (!data || data === "[DONE]" || data === "[END]") continue;

        let chunk: WorkersAiStreamChunk;
        try {
          chunk = JSON.parse(data) as WorkersAiStreamChunk;
        } catch {
          continue;
        }

        if (!started) {
          started = true;
          id = chunk.id ?? "";
          yield { type: "start", id, model: request.model };
        }

        const usage = mapUsage(chunk.usage);
        if (usage) yield { type: "usage", usage };

        if (typeof chunk.response === "string" && chunk.response.length > 0) {
          yield { type: "chunk", index: 0, delta: { content: chunk.response } };
        }
      }
    }
  }

  if (!started) yield { type: "start", id, model: request.model };
  yield { type: "finish", index: 0, finish_reason: "stop" };
}
