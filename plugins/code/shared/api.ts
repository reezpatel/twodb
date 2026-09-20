import type { TwodbMessage } from "@twodb/contracts";

export type CodeSession = {
  id: string;
  workspace_id: string;
  node_id: string;
  title: string;
  folder: string;
  connection_id: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSessionRequest = {
  title: string;
  node_id: string;
  folder: string;
  connection_id?: string | null;
  model?: string | null;
};

export type RunRequest = {
  message: string;
};

export type CodeSessionEvent =
  | { type: "run_started"; run_id: string; at: string }
  | { type: "user_message"; text: string; at: string }
  | { type: "assistant_delta"; run_id: string; text: string; at: string }
  | { type: "tool_call"; run_id: string; call_id: string; name: string; args: string; at: string }
  | { type: "tool_result"; run_id: string; call_id: string; name: string; ok: boolean; output: string; at: string }
  | { type: "assistant_message"; run_id: string; text: string; at: string }
  | {
      type: "usage";
      run_id: string;
      input_tokens: number;
      output_tokens: number;
      tokens_per_second: number | null;
      at: string;
    }
  | { type: "run_finished"; run_id: string; reason: "completed" | "error" | "max_turns"; at: string }
  | { type: "error"; run_id: string | null; error: string; at: string };

export type CodeSessionClientMessage =
  | { kind: "subscribe"; sessionId: string }
  | { kind: "unsubscribe"; sessionId: string }
  | { kind: "send"; sessionId: string; message: string }
  | { kind: "set_connection"; sessionId: string; connectionId: string | null }
  | { kind: "set_model"; sessionId: string; model: string | null };

export type CodeSessionServerMessage =
  | { kind: "subscribed"; sessionId: string; snapshot: CodeSessionEvent[] }
  | { kind: "unsubscribed"; sessionId: string }
  | { kind: "event"; sessionId: string; event: CodeSessionEvent }
  | { kind: "error"; message: string };

export type StoredMessage = {
  id: string;
  run_id: string | null;
  role: "system" | "user" | "assistant" | "tool";
  content: TwodbMessage["content"] | null;
  tool_calls: TwodbMessage extends { tool_calls?: infer T } ? T : never;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
};
