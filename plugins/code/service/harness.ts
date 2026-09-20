import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { TwodbMessage, TwodbStreamEvent } from "@twodb/contracts";
import type { CodeTables } from "./db";
import { runtime } from "./runtime";
import { executeTool, toolDefinitions, type ToolContext } from "./tools";

const MAX_TURNS = 16;

const SYSTEM_PROMPT = `You are a coding agent working inside a session folder on a remote machine.
- File paths are relative to the session folder; never use absolute paths.
- read/write/patch files with the tools; run shell commands (ls, grep, git, cargo, npm…) with the command tool.
- patch line numbers are 0-based over the file split on newlines; ops apply high-index first.
- Inspect before editing: read (or grep) first, then patch or write.
- When the task is complete, reply with a concise summary of what changed — no tool calls.`;

export type HarnessDeps = {
  kysely: Kysely<CodeTables>;
  invoke: <T>(name: string, ...args: unknown[]) => Promise<T>;
};

type SessionRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  title: string;
  folder: string;
  connection_id: string | null;
  model: string | null;
};

type MessageRow = {
  id: string;
  run_id: string | null;
  role: string;
  content: string | null;
  tool_calls: unknown[] | null;
  tool_call_id: string | null;
  name: string | null;
};

const toMessage = (row: MessageRow): TwodbMessage | null => {
  switch (row.role) {
    case "system":
      return row.content == null ? null : { role: "system", content: row.content };
    case "user":
      return row.content == null ? null : { role: "user", content: row.content };
    case "assistant":
      return {
        role: "assistant",
        content: row.content,
        ...(row.tool_calls
          ? { tool_calls: row.tool_calls as TwodbMessage extends never ? never : NonNullable<Extract<TwodbMessage, { role: "assistant" }>["tool_calls"]> }
          : {}),
      };
    case "tool":
      return {
        role: "tool",
        tool_call_id: row.tool_call_id ?? "",
        ...(row.name ? { name: row.name } : {}),
        content: row.content ?? "",
      };
    default:
      return null;
  }
};

async function persistMessage(deps: HarnessDeps, sessionId: string, message: TwodbMessage, runId: string | null): Promise<void> {
  const values = {
    session_id: sessionId,
    run_id: runId,
    role: message.role,
    content: typeof message.content === "string" ? message.content : message.content == null ? null : JSON.stringify(message.content),
    tool_calls: message.role === "assistant" && message.tool_calls ? sql<unknown[]>`${JSON.stringify(message.tool_calls)}::jsonb` : null,
    tool_call_id: message.role === "tool" ? message.tool_call_id : null,
    name: message.role === "tool" ? (message.name ?? null) : null,
  };
  await deps.kysely.insertInto("code_session_messages").values(values).execute();
  await deps.kysely.updateTable("code_sessions").set({ updated_at: new Date() }).where("id", "=", sessionId).execute();
}

async function loadHistory(deps: HarnessDeps, sessionId: string): Promise<TwodbMessage[]> {
  const rows = await deps.kysely.selectFrom("code_session_messages").selectAll().where("session_id", "=", sessionId).orderBy("created_at").execute();
  return rows.map((row) => toMessage(row as MessageRow)).filter((message): message is TwodbMessage => message !== null);
}

export function runSession(deps: HarnessDeps, session: SessionRow, message: string): void {
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = session.id;
  const emit = (event: Parameters<typeof runtime.emit>[1]) => runtime.emit(sessionId, event);

  if (!runtime.begin(sessionId, runId)) {
    emit({ type: "error", run_id: null, error: "session already running", at: new Date().toISOString() });
    return;
  }

  void (async () => {
    const toolCtx: ToolContext = {
      nodeId: session.node_id,
      folder: session.folder,
      invoke: deps.invoke,
    };

    try {
      emit({ type: "run_started", run_id: runId, at: new Date().toISOString() });
      emit({ type: "user_message", text: message, at: new Date().toISOString() });
      await persistMessage(deps, sessionId, { role: "user", content: message }, runId);

      const messages: TwodbMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...(await loadHistory(deps, sessionId))];

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const stream = await deps.invoke<AsyncIterable<TwodbStreamEvent>>("llm.stream", {
          workspaceId: session.workspace_id,
          connectionId: session.connection_id,
          request: {
            ...(session.model ? { model: session.model } : {}),
            messages,
            tools: toolDefinitions,
          },
        });

        let text = "";
        const toolCallAcc = new Map<number, { id: string; name: string; args: string }>();
        const turnStartedAt = Date.now();
        let turnOutputTokens = 0;

        for await (const event of stream) {
          if (event.type === "error") {
            throw new Error(event.error);
          }
          if (event.type === "usage") {
            turnOutputTokens = event.usage.output_tokens;
            const elapsed = (Date.now() - turnStartedAt) / 1000;
            emit({
              type: "usage",
              run_id: runId,
              input_tokens: event.usage.input_tokens,
              output_tokens: event.usage.output_tokens,
              tokens_per_second: elapsed > 0.5 ? Math.round(event.usage.output_tokens / elapsed) : null,
              at: new Date().toISOString(),
            });
            continue;
          }
          if (event.type !== "chunk") {
            continue;
          }
          if (event.delta.content) {
            text += event.delta.content;
            emit({ type: "assistant_delta", run_id: runId, text: event.delta.content, at: new Date().toISOString() });
          }
          for (const call of event.delta.tool_calls ?? []) {
            const existing = toolCallAcc.get(call.index) ?? { id: "", name: "", args: "" };
            if (call.id) existing.id = call.id;
            if (call.function?.name) existing.name = call.function.name;
            if (call.function?.arguments) existing.args += call.function.arguments;
            toolCallAcc.set(call.index, existing);
          }
        }

        const toolCalls = [...toolCallAcc.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, call]) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: call.args } }));

        if (toolCalls.length === 0 && text === "" && turnOutputTokens === 0) {
          emit({ type: "error", run_id: runId, error: "empty completion response", at: new Date().toISOString() });
          break;
        }

        const assistantMessage: TwodbMessage = {
          role: "assistant",
          content: text === "" ? null : text,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        };
        messages.push(assistantMessage);
        await persistMessage(deps, sessionId, assistantMessage, runId);

        if (toolCalls.length > 0) {
          for (const call of toolCalls) {
            emit({
              type: "tool_call",
              run_id: runId,
              call_id: call.id,
              name: call.function.name,
              args: call.function.arguments,
              at: new Date().toISOString(),
            });

            const result = await executeTool(toolCtx, call);

            emit({
              type: "tool_result",
              run_id: runId,
              call_id: call.id,
              name: call.function.name,
              ok: result.ok,
              output: result.output,
              at: new Date().toISOString(),
            });

            const toolMessage: TwodbMessage = {
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: result.output || "(no output)",
            };
            messages.push(toolMessage);
            await persistMessage(deps, sessionId, toolMessage, runId);
          }
          continue;
        }

        emit({ type: "assistant_message", run_id: runId, text, at: new Date().toISOString() });
        emit({ type: "run_finished", run_id: runId, reason: "completed", at: new Date().toISOString() });
        return;
      }

      emit({ type: "run_finished", run_id: runId, reason: "max_turns", at: new Date().toISOString() });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      emit({ type: "error", run_id: runId, error: detail, at: new Date().toISOString() });
      emit({ type: "run_finished", run_id: runId, reason: "error", at: new Date().toISOString() });
    } finally {
      runtime.finish(sessionId);
    }
  })();
}
