import { bedrockSignedHeaders, assertBedrockRegion, type AwsCredentials } from "./sigv4";
import type { AnthropicMessagesRequest, AnthropicMessagesResponse } from "./anthropic";

const REQUEST_TIMEOUT_MS = 120_000;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export type AnthropicStreamEvent =
  | { type: "message_start"; message: { id?: string; model?: string; usage?: Record<string, unknown> } }
  | { type: "content_block_start"; index: number; content_block: Record<string, unknown> }
  | { type: "content_block_delta"; index: number; delta: Record<string, unknown> }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: { stop_reason?: string | null }; usage?: { output_tokens?: number } }
  | { type: "message_stop" }
  | { type: "ping" }
  | { type: "error"; error: { type?: string; message?: string } };

export type BedrockInvokeOptions = {
  region: string;
  credentials: AwsCredentials;
};

const decoder = new TextDecoder();

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function modelUrl(region: string, model: string, stream: boolean): URL {
  assertBedrockRegion(region);
  if (!MODEL_ID_PATTERN.test(model)) throw new Error(`invalid model id: ${model}`);
  const action = stream ? "invoke-with-response-stream" : "invoke";
  try {
    return new URL(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/${action}`);
  } catch {
    throw new Error(`invalid Bedrock endpoint for region ${region}`);
  }
}

async function postModel(options: BedrockInvokeOptions, model: string, request: AnthropicMessagesRequest, stream: boolean): Promise<Response> {
  const endpoint = modelUrl(options.region, model, stream);
  const body = JSON.stringify(request);
  const signed = bedrockSignedHeaders({
    method: "POST",
    url: endpoint,
    body,
    region: options.region,
    credentials: options.credentials,
  });
  const { host: _host, ...headers } = signed;
  return fetch(endpoint, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function bedrockComplete(options: BedrockInvokeOptions, model: string, request: AnthropicMessagesRequest): Promise<AnthropicMessagesResponse> {
  const response = await postModel(options, model, request, false);
  const text = await response.text();
  if (!response.ok) throw new Error(`Bedrock API error ${response.status}: ${sanitizeError(text)}`);
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as AnthropicMessagesResponse) : {};
  } catch {
    throw new Error(`invalid JSON response: ${sanitizeError(text)}`);
  }
}

type BedrockEvent = { headers: Map<string, string>; payload: Uint8Array };

function concatBytes(head: Uint8Array, tail: Uint8Array): Uint8Array {
  const merged = new Uint8Array(head.byteLength + tail.byteLength);
  merged.set(head);
  merged.set(tail, head.byteLength);
  return merged;
}

function parseEventStreamFrames(buffer: Uint8Array): { events: BedrockEvent[]; rest: Uint8Array } {
  const events: BedrockEvent[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  while (offset + 16 <= buffer.byteLength) {
    const totalLength = view.getUint32(offset);
    if (totalLength < 16 || offset + totalLength > buffer.byteLength) break;
    const headersLength = view.getUint32(offset + 4);
    const headers = new Map<string, string>();
    let cursor = offset + 12;
    const headersEnd = cursor + headersLength;

    while (cursor + 2 <= headersEnd) {
      const nameLength = view.getUint8(cursor);
      cursor += 1;
      const name = decoder.decode(buffer.subarray(cursor, cursor + nameLength));
      cursor += nameLength;
      const valueType = view.getUint8(cursor);
      cursor += 1;
      let value = "";
      switch (valueType) {
        case 7: {
          const length = view.getUint16(cursor);
          cursor += 2;
          value = decoder.decode(buffer.subarray(cursor, cursor + length));
          cursor += length;
          break;
        }
        case 0:
          value = "true";
          break;
        case 1:
          value = "false";
          break;
        case 2:
          value = String(view.getInt8(cursor));
          cursor += 1;
          break;
        case 3:
          value = String(view.getInt16(cursor));
          cursor += 2;
          break;
        case 4:
          value = String(view.getInt32(cursor));
          cursor += 4;
          break;
        case 5:
          value = String(view.getBigInt64(cursor));
          cursor += 8;
          break;
        case 6:
          cursor += 2 + view.getUint16(cursor);
          break;
        case 8:
          cursor += 8;
          break;
        default:
          cursor = headersEnd;
          break;
      }
      headers.set(name, value);
    }

    const payloadEnd = offset + totalLength - 4;
    events.push({ headers, payload: buffer.subarray(headersEnd, payloadEnd) });
    offset += totalLength;
  }

  return { events, rest: buffer.subarray(offset) };
}

function sseData(rawEvent: string): string | null {
  const parts: string[] = [];
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.replace(/\r$/, "");
    if (trimmed.startsWith("data:")) parts.push(trimmed.slice(5).trimStart());
  }
  return parts.length ? parts.join("\n") : null;
}

function extractSseEvents(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  let remaining = buffer;
  let boundary = /\r?\n\r?\n/.exec(remaining);
  while (boundary !== null) {
    const rawEvent = remaining.slice(0, boundary.index);
    remaining = remaining.slice(boundary.index + boundary[0].length);
    boundary = /\r?\n\r?\n/.exec(remaining);
    const data = sseData(rawEvent);
    if (data) events.push(data);
  }
  return { events, rest: remaining };
}

export async function* bedrockStream(options: BedrockInvokeOptions, model: string, request: AnthropicMessagesRequest): AsyncGenerator<AnthropicStreamEvent> {
  const response = await postModel(options, model, request, true);
  if (!response.ok) {
    throw new Error(`Bedrock API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  if (!response.body) throw new Error("Bedrock API returned an empty response body");

  const reader = response.body.getReader();
  let frames: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let sseBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    frames = concatBytes(frames, value);

    const parsed = parseEventStreamFrames(frames);
    frames = parsed.rest;

    for (const event of parsed.events) {
      const payloadText = decoder.decode(event.payload);
      const exceptionType = event.headers.get(":exception-type") ?? "";
      const eventType = event.headers.get(":event-type") ?? "";
      if (exceptionType || (eventType !== "" && eventType !== "chunk")) {
        let message = payloadText;
        try {
          message = String((JSON.parse(payloadText) as { message?: unknown }).message ?? payloadText);
        } catch {
          // keep raw payload as message
        }
        throw new Error(`Bedrock stream error (${exceptionType || eventType}): ${sanitizeError(message)}`);
      }
      if (eventType !== "chunk") continue;

      let chunk: { chunk?: { bytes?: unknown } };
      try {
        chunk = JSON.parse(payloadText) as { chunk?: { bytes?: unknown } };
      } catch {
        continue;
      }
      if (typeof chunk.chunk?.bytes !== "string" || !chunk.chunk.bytes) continue;

      sseBuffer += Buffer.from(chunk.chunk.bytes, "base64").toString("utf8");
      const extracted = extractSseEvents(sseBuffer);
      sseBuffer = extracted.rest;
      for (const data of extracted.events) {
        let parsedEvent: AnthropicStreamEvent;
        try {
          parsedEvent = JSON.parse(data) as AnthropicStreamEvent;
        } catch {
          throw new Error(`invalid SSE payload: ${sanitizeError(data)}`);
        }
        yield parsedEvent;
      }
    }
  }
}
