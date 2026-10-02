import { db } from "../../auth";
import type { AssistantThreadTable, LlmConnectionTable } from "../../plugins/db";
import { runAgentRound, type AgentMessage, type AgentTool, type ThinkingLevel } from "../agent";

const MAX_ROUNDS = 8;

const SYSTEM_PROMPT = `You are twodb assistant, a helpful general-purpose chat assistant.
You have a canvas: a side panel the user can see live. Whenever you produce or refine a
substantial document — plans, summaries, essays, code files, HTML pages, tables — call the
update_canvas tool with its full content instead of pasting long blocks into the chat.
Keep chat replies short and conversational; put the substance on the canvas.`;

interface CanvasUpdate {
  id: string;
  title: string;
  type: "markdown" | "html" | "code" | "text";
  content: string;
  updatedAt: string;
}

export type AssistantFrame =
  | { type: "round_start"; round: number }
  | { type: "delta"; text: string }
  | { type: "thinking_start"; round: number }
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_end"; round: number }
  | { type: "canvas"; artifact: CanvasUpdate }
  | { type: "status"; text: string }
  | { type: "round_done"; round: number; usage: { inputTokens: number; outputTokens: number; cachedTokens: number }; durationMs: number }
  | { type: "error"; message: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number; cachedTokens: number }; contextTokens: number };

export type FrameSink = (frame: AssistantFrame) => void | Promise<void>;

const CANVAS_TOOL: AgentTool = {
  name: "update_canvas",
  description:
    "Creates or updates the canvas document shown beside the chat. Call with the FULL content every time (it replaces the previous version of that title).",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short document title" },
      type: { type: "string", enum: ["markdown", "html", "code", "text"], description: "Content format" },
      content: { type: "string", description: "Full document content" },
    },
    required: ["title", "type", "content"],
  },
};

const ARTIFACT_TYPES = new Set(["markdown", "html", "code", "text"]);

export interface AssistantLoopInput {
  thread: AssistantThreadTable;
  connection: LlmConnectionTable;
  model: string;
  history: AgentMessage[];
  userContent: string;
  organizationId: string;
  thinkingLevel?: ThinkingLevel;
}

export async function runAssistantLoop(input: AssistantLoopInput, emit: FrameSink): Promise<void> {
  const { thread, connection, model, userContent, organizationId } = input;
  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT, meta: null },
    ...input.history,
    { role: "user", content: userContent, meta: null },
  ];
  const totals = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let contextTokens = 0;
  let lastRoundStart = Date.now();

  const insertMessage = (role: string, content: string, meta: Record<string, unknown> | null) =>
    db.insertInto("assistant_message").values({ id: crypto.randomUUID(), threadId: thread.id, role, content, meta, createdAt: new Date() }).execute();

  const logUsage = (usage: { inputTokens: number; outputTokens: number; cachedTokens: number }) =>
    db
      .insertInto("llm_usage_event")
      .values({
        id: crypto.randomUUID(),
        organizationId,
        connectionId: connection.id,
        correlationId: thread.id,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedTokens,
        createdAt: new Date(),
      })
      .execute();

  const upsertArtifact = async (call: { arguments: Record<string, unknown> }): Promise<CanvasUpdate> => {
    const title = String(call.arguments.title ?? "Untitled").slice(0, 120);
    const rawType = String(call.arguments.type ?? "markdown");
    const type = (ARTIFACT_TYPES.has(rawType) ? rawType : "markdown") as CanvasUpdate["type"];
    const content = String(call.arguments.content ?? "");

    const now = new Date();
    await db
      .insertInto("assistant_artifact")
      .values({ id: crypto.randomUUID(), threadId: thread.id, organizationId, title, type, content, createdAt: now, updatedAt: now })
      .onConflict((oc) => oc.column("threadId").column("title").doUpdateSet({ type, content, updatedAt: now }))
      .execute();

    const artifact = await db
      .selectFrom("assistant_artifact")
      .selectAll()
      .where("threadId", "=", thread.id)
      .where("title", "=", title)
      .executeTakeFirstOrThrow();

    return {
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      content: artifact.content,
      updatedAt: artifact.updatedAt.toISOString(),
    };
  };

  try {
    const thinkingLevel = input.thinkingLevel ?? "medium";
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      lastRoundStart = Date.now();
      let roundThinking = "";
      let roundThinkingStart = 0;
      let roundThinkingMs = 0;
      await emit({ type: "round_start", round });
      const result = await runAgentRound(
        connection,
        model,
        messages,
        [CANVAS_TOOL],
        (text) => {
          void emit({ type: "delta", text });
        },
        {
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

      totals.inputTokens += result.usage.inputTokens;
      totals.outputTokens += result.usage.outputTokens;
      totals.cachedTokens += result.usage.cachedTokens;
      contextTokens = result.usage.inputTokens + result.usage.outputTokens;
      await logUsage(result.usage);
      await emit({ type: "round_done", round, usage: result.usage, durationMs: Date.now() - lastRoundStart });

      const canvasCalls = result.toolCalls.filter((call) => call.name === "update_canvas");
      const otherCalls = result.toolCalls.filter((call) => call.name !== "update_canvas");

      const thinkingMeta = result.thinking?.length ? { thinking: result.thinking.map((t) => ({ ...t, durationMs: roundThinkingMs })), thinkingLevel } : {};

      if (result.toolCalls.length === 0) {
        if (result.content || result.thinking?.length) {
          await insertMessage("assistant", result.content ?? "", Object.keys(thinkingMeta).length ? thinkingMeta : null);
        }
        break;
      }

      const assistantMeta = { ...thinkingMeta, toolCalls: result.toolCalls };
      await insertMessage("assistant", result.content ?? "", assistantMeta);
      messages.push({ role: "assistant", content: result.content ?? "", meta: assistantMeta });

      for (const call of canvasCalls) {
        const artifact = await upsertArtifact(call);
        await emit({ type: "canvas", artifact });
        await insertMessage("tool", `canvas updated: ${artifact.title}`, { toolCallId: call.id, name: call.name });
        messages.push({
          role: "tool",
          content: `canvas updated: ${artifact.title}`,
          meta: { toolCallId: call.id, name: call.name },
        });
      }

      for (const call of otherCalls) {
        const output = `error: tool "${call.name}" is not available in assistant chats`;
        await insertMessage("tool", output, { toolCallId: call.id, name: call.name });
        messages.push({ role: "tool", content: output, meta: { toolCallId: call.id, name: call.name } });
      }
    }
  } catch (e) {
    await emit({ type: "error", message: (e as Error).message });
  }

  await emit({ type: "done", usage: totals, contextTokens });
}
