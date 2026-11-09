import type { LlmConnectionRow } from "../db/schema.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface LlmProvider {
  /** Streams the raw upstream response body through unmodified — the Gateway/CLI pass it straight to the caller. */
  streamCompletion(connection: LlmConnectionRow, req: CompletionRequest): Promise<Response>;
}
