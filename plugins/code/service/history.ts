import type { Kysely } from "kysely";
import type { CodeSessionEvent } from "../shared/api";
import type { CodeTables } from "./db";

type MessageRow = {
  run_id: string | null;
  role: string;
  content: string | null;
  tool_calls: Array<{ id: string; function: { name: string; arguments: string } }> | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: Date;
};

type ToolCall = { id: string; type: string; function: { name: string; arguments: string } };

// The event buffer is in-memory and empty after an api restart — rebuild it
// from the persisted conversation so a refresh shows the full history.
export async function hydrateSessionEvents(kysely: Kysely<CodeTables>, sessionId: string): Promise<CodeSessionEvent[]> {
  const rows = await kysely.selectFrom("code_session_messages").selectAll().where("session_id", "=", sessionId).orderBy("created_at").limit(500).execute();

  const events: CodeSessionEvent[] = [];
  for (const row of rows as MessageRow[]) {
    const runId = row.run_id ?? "history";
    const at = row.created_at.toISOString();

    if (row.role === "user" && row.content != null) {
      events.push({ type: "user_message", text: row.content, at });
      continue;
    }

    if (row.role === "assistant") {
      for (const call of (row.tool_calls ?? []) as ToolCall[]) {
        events.push({
          type: "tool_call",
          run_id: runId,
          call_id: call.id,
          name: call.function.name,
          args: call.function.arguments,
          at,
        });
      }
      if (row.content != null && row.content !== "") {
        events.push({ type: "assistant_message", run_id: runId, text: row.content, at });
      }
      continue;
    }

    if (row.role === "tool") {
      events.push({
        type: "tool_result",
        run_id: runId,
        call_id: row.tool_call_id ?? "",
        name: row.name ?? "",
        ok: true,
        output: row.content ?? "",
        at,
      });
    }
  }

  return events;
}
