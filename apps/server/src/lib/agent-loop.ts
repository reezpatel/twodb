import { db } from "../auth";
import type { Selectable } from "kysely";
import type { CodeSessionTable, LlmConnectionTable } from "../plugins/db";
import { runAgentRound, type AgentMessage } from "./agent";
import { AGENT_TOOLS, executeToolCall } from "./agent-tools";

export const MAX_ROUNDS = 8;

export interface RoundUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

/** Everything the UI can receive live while a message is being processed. */
export type AgentFrame =
  | { type: "round_start"; round: number }
  | { type: "delta"; text: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_output"; id: string; stream: "stdout" | "stderr"; data: string }
  | { type: "tool_result"; id: string; name: string; output: string }
  | { type: "status"; text: string }
  | { type: "round_done"; round: number; usage: RoundUsage; durationMs: number }
  | { type: "error"; message: string }
  | { type: "done"; usage: RoundUsage; contextTokens: number };

export type FrameSink = (frame: AgentFrame) => void | Promise<void>;

export interface AgentLoopInput {
  session: Selectable<CodeSessionTable>;
  connection: Selectable<LlmConnectionTable>;
  model: string;
  runnerId: string | null;
  history: AgentMessage[];
  userContent: string;
  organizationId: string;
}

/**
 * Runs the full agent loop for one user message: model rounds streamed through
 * `emit`, tool calls executed on the session's runner with live output, every
 * message + usage event persisted. Always emits `done` (or `error` first).
 */
export async function runAgentLoop(input: AgentLoopInput, emit: FrameSink): Promise<void> {
  const { session, connection, model, runnerId, userContent, organizationId } = input;
  const messages: AgentMessage[] = [...input.history, { role: "user", content: userContent, meta: null }];
  const totals: RoundUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let contextTokens = 0;
  let lastRoundStart = Date.now();

  const insertMessage = (role: string, content: string, meta: Record<string, unknown> | null) =>
    db
      .insertInto("code_session_message")
      .values({
        id: crypto.randomUUID(),
        sessionId: session.id,
        role,
        content,
        meta,
        createdAt: new Date(),
      })
      .execute();

  const logUsage = async (usage: RoundUsage) => {
    const base = {
      connectionId: connection.id,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedTokens,
      createdAt: new Date(),
    };

    await db
      .insertInto("code_session_usage_event")
      .values({ id: crypto.randomUUID(), sessionId: session.id, ...base })
      .execute();

    await db
      .insertInto("llm_usage_event")
      .values({ id: crypto.randomUUID(), organizationId, correlationId: session.id, ...base })
      .execute();
  };

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      lastRoundStart = Date.now();
      await emit({ type: "round_start", round });
      const result = await runAgentRound(connection, model, messages, AGENT_TOOLS, (text) => {
        void emit({ type: "delta", text });
      });

      totals.inputTokens += result.usage.inputTokens;
      totals.outputTokens += result.usage.outputTokens;
      totals.cachedTokens += result.usage.cachedTokens;
      contextTokens = result.usage.inputTokens + result.usage.outputTokens;
      await logUsage(result.usage);
      await emit({ type: "round_done", round, usage: result.usage, durationMs: Date.now() - lastRoundStart });

      if (result.toolCalls.length === 0) {
        if (result.content) await insertMessage("assistant", result.content, null);
        break;
      }

      await insertMessage("assistant", result.content ?? "", { toolCalls: result.toolCalls });
      messages.push({
        role: "assistant",
        content: result.content ?? "",
        meta: { toolCalls: result.toolCalls },
      });

      for (const call of result.toolCalls) {
        await emit({ type: "tool_start", id: call.id, name: call.name, args: call.arguments });
        const output = await executeToolCall(
          runnerId,
          call,
          (stream, data) => {
            void emit({ type: "tool_output", id: call.id, stream, data });
          },
          () => {
            void emit({ type: "status", text: "runner is offline — waiting for it to come back (up to 60 min)…" });
          },
        );
        await emit({ type: "tool_result", id: call.id, name: call.name, output });
        await insertMessage("tool", output, { toolCallId: call.id, name: call.name });
        messages.push({
          role: "tool",
          content: output,
          meta: { toolCallId: call.id, name: call.name },
        });
      }
    }
  } catch (e) {
    await emit({ type: "error", message: (e as Error).message });
  }

  await emit({ type: "done", usage: totals, contextTokens });
}
