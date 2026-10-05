import type { Selectable } from "kysely";
import { db } from "../auth";
import type { CodeSessionTable, LlmConnectionTable } from "../plugins/db";
import { runAgentRound, type AgentMessage } from "./agent";

// Context compaction for code sessions, ported from pi's model. No provider
// exposes a native compact endpoint (pi, Claude Code and Codex all summarize),
// so compaction is a plain LLM call over the serialized history. The summary is
// stored as a role="compaction" row in code_session_message; later rounds replay
// [summary, ...kept messages] as context. Repeated compactions update the
// previous summary instead of re-summarizing everything.

export const KEEP_RECENT_TOKENS = 20_000;
/** Headroom kept below the context window before auto-compaction fires (pi default). */
export const COMPACT_RESERVE_TOKENS = 16_384;
const TOOL_RESULT_MAX_CHARS = 2000;

export interface CompactionUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface CompactionMeta {
  summary: string;
  /** First message row kept verbatim after this compaction. */
  firstKeptMessageId: string;
  /** Context size when compaction ran (last round usage, else chars/4). */
  tokensBefore: number;
  /** Estimated context after compaction (summary + kept, chars/4). */
  estimatedTokensAfter: number;
  /** Usage of the summarization call itself — feeds the pricing block. */
  usage: CompactionUsage;
  /** Summarization cost in USD, when the model has stored pricing. */
  costUsd: number | null;
  model: string;
  connectionId: string;
  /** Extra focus passed via "/compact <instructions>". */
  instructions: string | null;
}

type MessageRow = {
  id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

const COMPACTION_SUMMARY_PREFIX = "The conversation history before this point was compacted into the following summary:\n\n<summary>\n";
const COMPACTION_SUMMARY_SUFFIX = "\n</summary>";

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

// --- projection --------------------------------------------------------------

export function toAgentMessage(row: MessageRow): AgentMessage {
  // Uploaded-asset refs persist inside meta; lift them so vision rounds can
  // resolve bytes from the message itself.
  const images = (row.meta as { images?: AgentMessage["images"] } | null)?.images;
  return {
    role: row.role as AgentMessage["role"],
    content: row.content,
    meta: (row.meta as AgentMessage["meta"]) ?? null,
    ...(images?.length ? { images } : {}),
  };
}

function compactionMeta(row: MessageRow): CompactionMeta | null {
  if (row.role !== "compaction") return null;
  const meta = row.meta as Partial<CompactionMeta> | null;
  return meta?.summary && meta.firstKeptMessageId ? (meta as CompactionMeta) : null;
}

/** A context boundary: compaction (summary + kept tail) or clear (hard cutoff, nothing replayed). */
function boundaryInfo(row: MessageRow): { type: "compaction"; meta: CompactionMeta } | { type: "clear" } | null {
  if (compactionMeta(row)) return { type: "compaction", meta: compactionMeta(row)! };
  if (row.role === "clear") return { type: "clear" };
  return null;
}

function summaryContextMessage(summary: string): AgentMessage {
  return { role: "user", content: COMPACTION_SUMMARY_PREFIX + summary + COMPACTION_SUMMARY_SUFFIX, meta: null };
}

interface ProjectedItem {
  row: MessageRow | null;
  message: AgentMessage;
}

/**
 * Applies the newest context boundary. A compaction replays its summary plus
 * everything kept from `firstKeptMessageId` onward; a clear is a hard cutoff —
 * nothing before it is sent again, no summary either. Older boundary rows and
 * everything they supersede drop out of context.
 */
function projectRows(rows: MessageRow[]): ProjectedItem[] {
  let boundaryIdx = -1;
  let boundary: { type: "compaction"; meta: CompactionMeta } | { type: "clear" } | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const info = boundaryInfo(rows[i]);
    if (info) {
      boundaryIdx = i;
      boundary = info;
      break;
    }
  }
  if (!boundary) return rows.map((row) => ({ row, message: toAgentMessage(row) }));

  if (boundary.type === "clear") {
    return rows.slice(boundaryIdx + 1).map((row) => ({ row, message: toAgentMessage(row) }));
  }

  const meta = boundary.meta;
  const keptIdx = rows.findIndex((r) => r.id === meta.firstKeptMessageId);
  const items: ProjectedItem[] = [{ row: null, message: summaryContextMessage(meta.summary) }];
  if (keptIdx >= 0) {
    for (const row of rows.slice(keptIdx, boundaryIdx)) {
      if (!boundaryInfo(row)) items.push({ row, message: toAgentMessage(row) });
    }
  }
  for (const row of rows.slice(boundaryIdx + 1)) {
    if (!boundaryInfo(row)) items.push({ row, message: toAgentMessage(row) });
  }
  return items;
}

/** History for the next agent round — compaction/clear-aware. */
export function projectHistory(rows: MessageRow[]): AgentMessage[] {
  // ask_user rows are UI markers (the wizard's durable state), never LLM context.
  const projected = projectRows(rows)
    .filter((item) => item.row?.role !== "ask_user")
    .map((item) => item.message);
  // A crash or restart between tool_use and tool_result leaves history that
  // providers reject — synthesize a placeholder result for every dangling call.
  const answered = new Set<string>();
  for (const m of projected) {
    if (m.role === "tool" && m.meta?.toolCallId) answered.add(m.meta.toolCallId);
  }
  const repaired: AgentMessage[] = [];
  for (const m of projected) {
    repaired.push(m);
    if (m.role === "assistant") {
      for (const tc of m.meta?.toolCalls ?? []) {
        if (!answered.has(tc.id)) {
          repaired.push({ role: "tool", content: "interrupted — no result recorded", meta: { toolCallId: tc.id, name: tc.name } });
        }
      }
    }
  }
  return repaired;
}

// --- token estimation + cut point --------------------------------------------

function estimateTokens(message: AgentMessage): number {
  let chars = message.content.length;
  for (const t of message.meta?.thinking ?? []) chars += t.text.length;
  for (const tc of message.meta?.toolCalls ?? []) chars += tc.name.length + JSON.stringify(tc.arguments).length;
  return Math.ceil(chars / 4);
}

/** Chars/4 estimate over an in-memory context — the auto-compact trigger before any round has usage. */
export function estimateContextTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m), 0);
}

/** A message row the compaction can cut at: user or assistant turns, never tool results. */
function isCutPoint(item: ProjectedItem): boolean {
  return item.row !== null && (item.row.role === "user" || item.row.role === "assistant");
}

/**
 * Walk backwards accumulating estimated tokens; once the keep-recent budget is
 * exceeded, cut at the closest valid cut point at or after that index (mirrors
 * pi — cutting at an assistant tool-call turn keeps its tool results attached).
 */
function findCutPoint(items: ProjectedItem[], startIndex: number): number {
  const cutPoints: number[] = [];
  for (let i = startIndex; i < items.length; i++) {
    if (isCutPoint(items[i])) cutPoints.push(i);
  }
  if (cutPoints.length === 0) return startIndex;

  let accumulated = 0;
  let cutIndex = cutPoints[0];
  for (let i = items.length - 1; i >= startIndex; i--) {
    accumulated += estimateTokens(items[i].message);
    if (accumulated >= KEEP_RECENT_TOKENS) {
      cutIndex = cutPoints.find((candidate) => candidate >= i) ?? cutPoints[cutPoints.length - 1];
      break;
    }
  }
  return cutIndex;
}

// --- serialization -----------------------------------------------------------

function truncateForSummary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[... ${text.length - maxChars} more characters truncated]`;
}

/** Flatten history to tagged text so the model summarizes instead of continuing it. */
function serializeConversation(messages: AgentMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      if (m.content) parts.push(`[User]: ${m.content}`);
    } else if (m.role === "assistant") {
      const thinking = (m.meta?.thinking ?? []).map((t) => t.text).join("\n");
      const toolCalls = (m.meta?.toolCalls ?? []).map((tc) => `${tc.name}(${JSON.stringify(tc.arguments)})`).join("; ");
      if (thinking) parts.push(`[Assistant thinking]: ${thinking}`);
      if (m.content) parts.push(`[Assistant]: ${m.content}`);
      if (toolCalls) parts.push(`[Assistant tool calls]: ${toolCalls}`);
    } else if (m.role === "tool") {
      if (m.content) parts.push(`[Tool ${m.meta?.name ?? m.meta?.toolCallId ?? "result"}]: ${truncateForSummary(m.content, TOOL_RESULT_MAX_CHARS)}`);
    }
  }
  return parts.join("\n\n");
}

// --- compaction ---------------------------------------------------------------

export class NothingToCompactError extends Error {
  constructor() {
    super("nothing_to_compact");
  }
}

async function summarizationCost(connectionId: string, model: string, usage: CompactionUsage): Promise<number | null> {
  const row = await db
    .selectFrom("llm_model")
    .select(["costInput", "costOutput", "costCacheRead"])
    .where("connectionId", "=", connectionId)
    .where("modelId", "=", model)
    .executeTakeFirst();
  if (!row || row.costInput === null || row.costOutput === null) return null;
  const cost =
    ((usage.inputTokens - usage.cachedTokens) / 1e6) * row.costInput +
    (usage.outputTokens / 1e6) * row.costOutput +
    (usage.cachedTokens / 1e6) * (row.costCacheRead ?? 0);
  return Math.round(cost * 1e6) / 1e6;
}

export interface CompactionInput {
  connection: Selectable<LlmConnectionTable>;
  model: string;
  /** Message rows, oldest first. */
  rows: MessageRow[];
  /** Extra focus from "/compact <instructions>". */
  instructions?: string;
  /** Persistence — code sessions and assistant threads differ only here. */
  store: CompactionStore;
}

/** Table-specific persistence for compaction. */
export interface CompactionStore {
  insertBoundary(role: "compaction" | "clear", content: string, meta: Record<string, unknown> | null): Promise<MessageRow>;
  logUsage(usage: CompactionUsage): Promise<void>;
  lastRoundUsage(): Promise<{ inputTokens: number; outputTokens: number } | undefined>;
  touch(): Promise<void>;
}

/** Code sessions: boundaries in code_session_message, usage in both event tables. */
export function codeCompactionStore(
  session: Selectable<CodeSessionTable>,
  connection: Selectable<LlmConnectionTable>,
  model: string,
  organizationId: string,
): CompactionStore {
  return {
    insertBoundary: (role, content, meta) =>
      db
        .insertInto("code_session_message")
        .values({ id: crypto.randomUUID(), sessionId: session.id, role, content, meta, createdAt: new Date() })
        .returningAll()
        .executeTakeFirstOrThrow(),
    logUsage: async (usage) => {
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
    },
    lastRoundUsage: async () =>
      db
        .selectFrom("code_session_usage_event")
        .select(["inputTokens", "outputTokens"])
        .where("sessionId", "=", session.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst(),
    touch: async () => {
      await db.updateTable("code_session").set({ updatedAt: new Date() }).where("id", "=", session.id).execute();
    },
  };
}

/** Compacts the session and persists the compaction row; returns it. */
export async function runCompaction(input: CompactionInput): Promise<MessageRow> {
  const { connection, model, rows, store } = input;

  const projected = projectRows(rows);
  // previousSummary only carries over when the newest boundary is a compaction;
  // a clear between it and now already dropped the old summary from context.
  let previousSummary: string | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const info = boundaryInfo(rows[i]);
    if (!info) continue;
    if (info.type === "compaction") previousSummary = info.meta.summary;
    break;
  }
  // The synthetic summary item (index 0 when the boundary is a compaction) is
  // represented by previousSummary; summarize real rows after it.
  const boundaryStart = previousSummary ? 1 : 0;

  const cutIndex = findCutPoint(projected, boundaryStart);
  if (cutIndex <= boundaryStart) throw new NothingToCompactError();

  const toSummarize = projected.slice(boundaryStart, cutIndex).map((item) => item.message);
  const kept = projected.slice(cutIndex);
  const firstKept = projected[cutIndex].row!;
  if (toSummarize.length === 0) throw new NothingToCompactError();

  let promptText = `<conversation>\n${serializeConversation(toSummarize)}\n</conversation>\n\n`;
  if (previousSummary) promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
  let basePrompt = previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;
  if (input.instructions) basePrompt = `${basePrompt}\n\nAdditional focus: ${input.instructions}`;
  promptText += basePrompt;

  const result = await runAgentRound(
    connection,
    model,
    [
      { role: "system", content: SUMMARIZATION_SYSTEM_PROMPT, meta: null },
      { role: "user", content: promptText, meta: null },
    ],
    [],
    () => {},
  );
  const summary = (result.content ?? "").trim();
  if (!summary) throw new Error("compaction_failed_empty_summary");
  if (result.toolCalls.length > 0) throw new Error("compaction_failed_tool_call");

  const usage: CompactionUsage = {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cachedTokens: result.usage.cachedTokens,
  };

  const lastUsage = await store.lastRoundUsage();
  const tokensBefore =
    lastUsage && lastUsage.inputTokens + lastUsage.outputTokens > 0
      ? lastUsage.inputTokens + lastUsage.outputTokens
      : projected.reduce((sum, item) => sum + estimateTokens(item.message), 0);
  const estimatedTokensAfter = estimateTokens(summaryContextMessage(summary)) + kept.reduce((sum, item) => sum + estimateTokens(item.message), 0);

  await store.logUsage(usage);

  const meta: CompactionMeta = {
    summary,
    firstKeptMessageId: firstKept.id,
    tokensBefore,
    estimatedTokensAfter,
    usage,
    costUsd: await summarizationCost(connection.id, model, usage),
    model,
    connectionId: connection.id,
    instructions: input.instructions?.trim() || null,
  };

  const row = await store.insertBoundary("compaction", summary, meta as unknown as Record<string, unknown>);
  await store.touch();
  return row;
}
