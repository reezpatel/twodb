import type { MessageRow } from "../db/schema.js";
import { parseJson } from "../db/repository.js";
import type { ChatMessage } from "../tworoute-client.js";

/** Serializes stored message rows into ChatMessages for the compactor. */
export function buildCompactionInput(rows: MessageRow[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") out.push({ role: "user", content: row.content });
    else if (row.role === "assistant") {
      const meta = parseJson<{ toolCalls?: Array<{ id: string; name: string }> }>(row.meta_json, {});
      const calls = meta.toolCalls ?? [];
      out.push({
        role: "assistant",
        content: row.content || (calls.length ? `[used tools: ${calls.map((c) => c.name).join(", ")}]` : null),
      });
    }
  }
  return out;
}
