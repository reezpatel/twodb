import { db } from "../auth";
import type { Selectable } from "kysely";
import type { CodeSessionTable, LlmConnectionTable } from "../plugins/db";
import {
  runAgentRound,
  type AgentImagePart,
  type AgentImageRef,
  type AgentMessage,
  type AgentRoundResult,
  type AgentToolCall,
  type ThinkingLevel,
  type ToolScope,
} from "./agent";
import { executeToolCall, toolsForScope, type CanvasArtifactResult, type ToolExecution } from "./agent-tools";
import { MAX_IMAGE_BASE64, resolveImageBase64 } from "./assets";
import { getProvider } from "./llm-providers";
import { clearAskUser, waitForAskUserResponse, type AskUserQuestion } from "./ask-user";
import { COMPACT_RESERVE_TOKENS, codeCompactionStore, estimateContextTokens, NothingToCompactError, projectHistory, runCompaction } from "./compaction";
import { resolveSessionSystemPrompt } from "./session-prompt";

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
  | { type: "tool_result"; id: string; name: string; output: string; status?: "ok" | "failed"; exitCode?: number }
  | { type: "ask_user"; id: string; questions: AskUserQuestion[] }
  | { type: "canvas"; artifact: CanvasArtifactResult }
  | { type: "status"; text: string }
  | { type: "compaction_done" }
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
  /** Uploaded assets attached to this send — refs persisted on the user row, bytes resolved per round for vision models. */
  userImages?: AgentImageRef[];
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
  const messages: AgentMessage[] = [
    ...input.history,
    { role: "user", content: userContent, meta: null, ...(input.userImages?.length ? { images: input.userImages } : {}) },
  ];
  // Directory-less sessions are assistant-style chats: no runner tools, canvas available.
  const toolScope: ToolScope = session.codeDirectoryId ? "code" : "assistant";
  const tools = toolsForScope(toolScope);
  const totals: RoundUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let contextTokens = 0;
  let lastRoundStart = Date.now();
  let stopped = false;

  // Model capacity for auto-compaction; unknown window disables it. Input
  // modalities gate whether uploaded images ride along as vision parts.
  const modelRow = await db
    .selectFrom("llm_model")
    .select(["contextWindow", "input"])
    .where("connectionId", "=", connection.id)
    .where("modelId", "=", model)
    .executeTakeFirst();
  const contextWindow = modelRow?.contextWindow ?? null;
  // Static-fallback models never get an llm_model row — fall back to a name
  // heuristic so vision still works without a models refresh.
  const VISION_MODEL_RE =
    /gpt-4o|gpt-4\.1|gpt-4\.5|gpt-5|"o3"|"o4"|-o3|-o4|claude-3|claude-4|claude-sonnet|claude-opus|claude-haiku|gemini|llama-?[34].*vision|llama-4|qwen-?vl|qwen2\.?5?-?vl|qwen-?image|grok-?4|grok-?vision|pixtral|llava|mistral-small-3\.[12]|gemma-3/i;
  const supportsImages = modelRow?.input.length ? modelRow.input.includes("image") : VISION_MODEL_RE.test(model);
  // Only the Anthropic wire renders images inside tool results; on openai-
  // compatible providers the upload-time attachment (replayed every round)
  // carries the picture.
  const imageToolResults = getProvider(connection.provider)?.api === "anthropic";

  // Vision rounds: user messages carrying asset refs get resolved image bytes
  // (cached per run). Non-image refs and non-vision models fall back to the
  // twodb:// link notation already present in the message text.
  const imageCache = new Map<string, AgentImagePart | null>();
  const withImageParts = async (msgs: AgentMessage[]): Promise<AgentMessage[]> => {
    if (!supportsImages) return msgs;
    const resolved: AgentMessage[] = [];
    for (const m of msgs) {
      if (m.role !== "user" || !m.images?.length) {
        resolved.push(m);
        continue;
      }
      const parts: AgentImagePart[] = [];
      for (const ref of m.images) {
        if (!imageCache.has(ref.uri)) {
          try {
            imageCache.set(ref.uri, await resolveImageBase64(organizationId, ref.uri));
          } catch {
            imageCache.set(ref.uri, null);
          }
        }
        const part = imageCache.get(ref.uri);
        // Providers cap image payloads — oversized images stay as link notation.
        if (part && part.base64.length <= MAX_IMAGE_BASE64) parts.push(part);
      }
      resolved.push(parts.length ? { ...m, imageParts: parts } : m);
    }
    return resolved;
  };

  /**
   * Auto-compaction: when the context approaches the model's window, persist a
   * compaction and continue the run against summary + kept messages. Everything
   * in `messages` is committed by this point, so the row-based compaction sees
   * exactly what the loop holds.
   */
  const maybeCompact = async () => {
    if (!contextWindow || contextWindow <= COMPACT_RESERVE_TOKENS) return;
    const current = contextTokens > 0 ? contextTokens : estimateContextTokens(messages);
    if (current <= contextWindow - COMPACT_RESERVE_TOKENS) return;
    await emit({ type: "status", text: "context near the model's window — compacting…" });
    try {
      const rows = await db.selectFrom("code_session_message").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "asc").execute();
      const compactionRow = await runCompaction({ connection, model, rows, store: codeCompactionStore(session, connection, model, organizationId) });
      messages.length = 0;
      messages.push(...projectHistory([...rows, compactionRow]));
      // The next round re-measures the compacted context from its own usage.
      contextTokens = 0;
      await emit({ type: "compaction_done" });
      await emit({ type: "status", text: "" });
    } catch (e) {
      if (e instanceof NothingToCompactError) {
        await emit({ type: "status", text: "" });
      } else {
        console.error("[agent-loop] auto-compaction failed:", e);
        await emit({ type: "status", text: "auto-compaction failed — continuing with full context" });
      }
    }
  };

  /** ask_user blocks on the user's answers via the WS bridge; returns a tool result. */
  const runAskUser = async (call: AgentToolCall): Promise<ToolExecution> => {
    const raw = Array.isArray(call.arguments?.questions) ? (call.arguments.questions as unknown[]) : [];
    const questions = raw.filter((q): q is AskUserQuestion => !!q && typeof (q as Record<string, unknown>).question === "string");
    if (questions.length === 0) {
      return { output: "error: ask_user requires at least one question with a question field", code: null, failed: true };
    }
    // Persist the open question — a refresh (or server restart) restores the
    // wizard from the transcript, and a dead loop's answers repair history.
    await insertMessage("ask_user", "", { toolCallId: call.id, name: call.name, questions });
    await emit({ type: "ask_user", id: call.id, questions });
    const resolution = await waitForAskUserResponse(session.id, call.id);
    if (resolution.cancelled) return { output: "user stopped without answering", code: null, failed: true };
    return { output: JSON.stringify({ answers: resolution.answers ?? [] }, null, 2), code: 0, failed: false };
  };

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

  // System prompt: a bound agent carries its own prompt (and its tags join the
  // skill/instruction match set); agent sessions skip runner repo skills. Org
  // override or the default otherwise, plus cwd, [Skills] titles, inline
  // instructions, and memories. Built once; prepended to every round so it
  // survives in-memory compaction.
  const agent = session.agentId
    ? await db.selectFrom("agent").selectAll().where("id", "=", session.agentId).where("organizationId", "=", organizationId).executeTakeFirst()
    : undefined;
  const { systemPrompt } = await resolveSessionSystemPrompt({
    organizationId,
    sessionId: session.id,
    codeDirectoryId: session.codeDirectoryId,
    sessionTags: [...(session.tags ?? []), ...(agent?.tags ?? [])],
    runnerId: agent ? null : runnerId,
    cwd,
    systemPromptOverride: agent?.instruction ?? null,
    mode: toolScope,
  });
  const systemMessage: AgentMessage = { role: "system", content: systemPrompt, meta: null };

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (signal?.aborted) {
        stopped = true;
        break;
      }
      await maybeCompact();
      if (signal?.aborted) {
        stopped = true;
        break;
      }
      lastRoundStart = Date.now();
      await emit({ type: "round_start", round });

      let roundText = "";
      let roundThinking = "";
      let roundThinkingStart = 0;
      let roundThinkingMs = 0;
      let result: AgentRoundResult | null = null;
      try {
        result = await runAgentRound(
          connection,
          model,
          await withImageParts([systemMessage, ...messages]),
          tools,
          (text) => {
            roundText += text;
            void emit({ type: "delta", text });
          },
          {
            signal,
            thinkingLevel,
            onThinkingStart: () => {
              roundThinkingStart = Date.now();
              roundThinkingMs = 0;
              void emit({ type: "thinking_start", round });
            },
            onThinkingDelta: (text) => {
              roundThinking += text;
              void emit({ type: "thinking_delta", text });
            },
            onThinkingEnd: () => {
              roundThinkingMs = Math.max(1, Date.now() - roundThinkingStart);
              void emit({ type: "thinking_end", round });
            },
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

      const thinkingMeta = result.thinking?.length ? { thinking: result.thinking.map((t) => ({ ...t, durationMs: roundThinkingMs })), thinkingLevel } : {};

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
        const startedAt = Date.now();
        await emit({ type: "tool_start", id: call.id, name: call.name, args: call.arguments });
        const exec = await raceAbort(
          call.name === "ask_user"
            ? runAskUser(call)
            : executeToolCall(
                runnerId,
                cwd,
                call,
                (stream, data) => {
                  void emit({ type: "tool_output", id: call.id, stream, data });
                },
                () => {
                  void emit({ type: "status", text: "runner is offline — waiting for it to come back (up to 60 min)…" });
                },
                { organizationId, sessionId: session.id, codeDirectoryId: session.codeDirectoryId, supportsImages, imageToolResults },
              ),
          signal,
        );
        if (exec === ABORTED) {
          clearAskUser(session.id);
          stopped = true;
          await emit({ type: "tool_result", id: call.id, name: call.name, output: "stopped by user" });
          await insertMessage("tool", "stopped by user", { toolCallId: call.id, name: call.name, stopped: true });
          messages.push({ role: "tool", content: "stopped by user", meta: { toolCallId: call.id, name: call.name } });
          continue;
        }
        const completedAt = Date.now();
        // Canvas updates stream as artifacts so viewers refresh the canvas tab live.
        if (exec.artifact) await emit({ type: "canvas", artifact: exec.artifact });
        const toolMeta = {
          toolCallId: call.id,
          name: call.name,
          startedAt,
          completedAt,
          status: exec.failed ? ("failed" as const) : ("ok" as const),
          ...(exec.code !== null ? { exitCode: exec.code } : {}),
        };
        await emit({ type: "tool_result", id: call.id, name: call.name, output: exec.output, status: toolMeta.status, exitCode: exec.code ?? undefined });
        await insertMessage("tool", exec.output, toolMeta);
        // Transient image parts (read_asset on images) ride the wire only — the
        // persisted row keeps the text output.
        messages.push({
          role: "tool",
          content: exec.output,
          meta: toolMeta,
          ...(exec.imageParts?.length ? { imageParts: exec.imageParts } : {}),
        });
      }
      if (stopped) break;
    }
  } catch (e) {
    await emit({ type: "error", message: (e as Error).message });
  }

  await emit({ type: "done", usage: totals, contextTokens, ...(stopped ? { stopped: true } : {}) });
}
