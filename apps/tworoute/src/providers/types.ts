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

  /**
   * Best-effort model listing (OpenAI's `GET /models` shape). Providers
   * without a listing API return null and the caller falls back to manual
   * model entry. Never throws — a listing failure shouldn't break anything.
   */
  listModels?(connection: LlmConnectionRow): Promise<string[] | null>;
}
