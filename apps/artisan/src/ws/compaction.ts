import type { RunDeps } from "./agent-loop.js";
import type { SessionRow } from "../db/schema.js";
import type { ChatMessage } from "../tworoute-client.js";

/**
 * Compaction: summarize the conversation into the thread's summary row,
 * closing the thread. The next thread opens with the summary as its opening
 * context. Repeated compactions rewrite the summary (summary + kept tail).
 */

const KEEP_RECENT_MESSAGES = 6;

export interface CompactionResult {
  summary: string;
}

export async function runCompaction(
  deps: RunDeps,
  session: SessionRow,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  // Serialize the conversation for the summarizer.
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      lines.push(`[tool result] ${m.content?.slice(0, 1500) ?? ""}`);
    } else if (m.tool_calls?.length) {
      lines.push(`[assistant used tools: ${m.tool_calls.map((t) => t.function.name).join(", ")}] ${m.content ?? ""}`);
    } else {
      lines.push(`[${m.role}] ${m.content ?? ""}`);
    }
  }
  const transcript = lines.join("\n").slice(0, 200_000);

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "Summarize this coding-agent conversation so work can continue in a fresh context. " +
        "Keep: the overall goal, decisions made, files touched (paths), commands/technologies, " +
        "current state, open problems, and immediate next steps. Be terse and factual. " +
        "Plain text only, no markdown headers above h2.",
    },
    { role: "user", content: transcript },
  ];

  let summary = "";
  for await (const chunk of deps.tworoute.streamChat({ model, messages: prompt, signal })) {
    if (chunk.delta?.content) summary += chunk.delta.content;
  }

  // Close the current thread with the summary; open the next with it.
  const thread = await deps.repo.currentThread(session.id);
  if (thread) {
    // Merge with a previous summary if this is a repeat compaction.
    const prior = thread.summary;
    const merged = prior ? `${summary}\n\n--- previous segment summary ---\n${prior}` : summary;
    await deps.repo.closeThread(thread.id);
    await deps.repo.openThread(session.id, merged);
  }
  return summary;
}
