import { db } from "../auth";
import type { Selectable } from "kysely";
import type { CodeSessionTable, LlmConnectionTable } from "../plugins/db";
import { runAgentRound, type AgentMessage, type AgentRoundResult, type ThinkingLevel } from "./agent";
import { AGENT_TOOLS, executeToolCall } from "./agent-tools";

export const MAX_ROUNDS = 60;

export interface RoundUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

/** Everything the UI can receive live while a message is being processed. */
export type AgentFrame =
  | { type: "round_start"; round: number }
  | { type: "thinking_start"; round: number }
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_end"; round: number }
  | { type: "delta"; text: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_output"; id: string; stream: "stdout" | "stderr"; data: string }
  | { type: "tool_result"; id: string; name: string; output: string }
  | { type: "status"; text: string }
  | { type: "round_done"; round: number; usage: RoundUsage; durationMs: number }
  | { type: "error"; message: string }
  | { type: "done"; usage: RoundUsage; contextTokens: number; stopped?: boolean };

export type FrameSink = (frame: AgentFrame) => void | Promise<void>;

export interface AgentLoopInput {
  session: Selectable<CodeSessionTable>;
  connection: Selectable<LlmConnectionTable>;
  model: string;
  runnerId: string | null;
  /** Working directory on the runner — tool commands execute inside it. */
  cwd: string | null;
  /** Aborts the loop: the in-flight round's partial output is committed. */
  signal?: AbortSignal;
  /** Reasoning effort for every round; undefined means the provider default. */
  thinkingLevel?: ThinkingLevel;
  history: AgentMessage[];
  userContent: string;
  organizationId: string;
}

const ABORTED = Symbol("aborted");

/** Resolves to ABORTED as soon as the signal fires instead of waiting for p. */
function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T | typeof ABORTED> {
  if (!signal) return p;
  if (signal.aborted) return Promise.resolve(ABORTED);
  return Promise.race([p, new Promise<typeof ABORTED>((resolve) => signal.addEventListener("abort", () => resolve(ABORTED), { once: true }))]);
}

/**
 * Runs the full agent loop for one user message: model rounds streamed through
 * `emit`, tool calls executed on the session's runner with live output, every
 * message + usage event persisted. Always emits `done` (or `error` first).
 */
export async function runAgentLoop(input: AgentLoopInput, emit: FrameSink): Promise<void> {
  const { session, connection, model, runnerId, cwd, userContent, organizationId } = input;
  const signal = input.signal;
  const thinkingLevel = input.thinkingLevel ?? "medium";
  const messages: AgentMessage[] = [...input.history, { role: "user", content: userContent, meta: null }];
  const totals: RoundUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let contextTokens = 0;
  let lastRoundStart = Date.now();
  let stopped = false;

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
      if (signal?.aborted) {
        stopped = true;
        break;
      }
      lastRoundStart = Date.now();
      await emit({ type: "round_start", round });

      let roundText = "";
      let roundThinking = "";
      let result: AgentRoundResult | null = null;
      try {
        result = await runAgentRound(
          connection,
          model,
          messages,
          AGENT_TOOLS,
          (text) => {
            roundText += text;
            void emit({ type: "delta", text });
          },
          {
            signal,
            thinkingLevel,
            onThinkingStart: () => void emit({ type: "thinking_start", round }),
            onThinkingDelta: (text) => {
              roundThinking += text;
              void emit({ type: "thinking_delta", text });
            },
            onThinkingEnd: () => void emit({ type: "thinking_end", round }),
          },
        );
      } catch (e) {
        if (!signal?.aborted) throw e;
        stopped = true;
      }

      if (!result) {
        // Aborted mid-round — commit the partial stream as a stopped message.
        if (roundText || roundThinking) {
          const meta: Record<string, unknown> = { stopped: true, thinkingLevel };
          if (roundThinking) meta.thinking = [{ text: roundThinking }];
          await insertMessage("assistant", roundText, meta);
        }
        break;
      }

      totals.inputTokens += result.usage.inputTokens;
      totals.outputTokens += result.usage.outputTokens;
      totals.cachedTokens += result.usage.cachedTokens;
      contextTokens = result.usage.inputTokens + result.usage.outputTokens;
      await logUsage(result.usage);

      const thinkingMeta = result.thinking?.length ? { thinking: result.thinking, thinkingLevel } : {};

      if (result.toolCalls.length === 0) {
        // Persist before round_done so a refetch at the round boundary sees it.
        if (result.content || result.thinking?.length) {
          await insertMessage("assistant", result.content ?? "", Object.keys(thinkingMeta).length ? thinkingMeta : null);
        }
        await emit({ type: "round_done", round, usage: result.usage, durationMs: Date.now() - lastRoundStart });
        break;
      }

      const assistantMeta = { ...thinkingMeta, toolCalls: result.toolCalls };
      await insertMessage("assistant", result.content ?? "", assistantMeta);
      messages.push({
        role: "assistant",
        content: result.content ?? "",
        meta: assistantMeta,
      });
      await emit({ type: "round_done", round, usage: result.usage, durationMs: Date.now() - lastRoundStart });

      for (const call of result.toolCalls) {
        if (signal?.aborted) stopped = true;
        if (stopped) {
          // History must keep a tool_result per tool_use or the next turn fails.
          await insertMessage("tool", "stopped by user", { toolCallId: call.id, name: call.name, stopped: true });
          messages.push({ role: "tool", content: "stopped by user", meta: { toolCallId: call.id, name: call.name } });
          continue;
        }
        await emit({ type: "tool_start", id: call.id, name: call.name, args: call.arguments });
        const output = await raceAbort(
          executeToolCall(
            runnerId,
            cwd,
            call,
            (stream, data) => {
              void emit({ type: "tool_output", id: call.id, stream, data });
            },
            () => {
              void emit({ type: "status", text: "runner is offline — waiting for it to come back (up to 60 min)…" });
            },
          ),
          signal,
        );
        if (output === ABORTED) {
          stopped = true;
          await emit({ type: "tool_result", id: call.id, name: call.name, output: "stopped by user" });
          await insertMessage("tool", "stopped by user", { toolCallId: call.id, name: call.name, stopped: true });
          messages.push({ role: "tool", content: "stopped by user", meta: { toolCallId: call.id, name: call.name } });
          continue;
        }
        await emit({ type: "tool_result", id: call.id, name: call.name, output });
        await insertMessage("tool", output, { toolCallId: call.id, name: call.name });
        messages.push({
          role: "tool",
          content: output,
          meta: { toolCallId: call.id, name: call.name },
        });
      }
      if (stopped) break;
    }
  } catch (e) {
    await emit({ type: "error", message: (e as Error).message });
  }

  await emit({ type: "done", usage: totals, contextTokens, ...(stopped ? { stopped: true } : {}) });
}
