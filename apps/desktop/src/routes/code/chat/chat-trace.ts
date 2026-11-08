import type { DiffRow, TraceNode } from "@twodb/blocks";
import { parseUnifiedDiff } from "@/components/blocks/code/code-chat/code-chat-diff-utils";

/** Convert a unified diff into blocks FileDiff rows + add/del stats. */
export function diffToRows(diff: string): { rows: DiffRow[]; add: number; del: number } {
  const lines = parseUnifiedDiff(diff);
  const rows: DiffRow[] = lines.map((line) => ({
    old: line.before ?? null,
    cur: line.after ?? null,
    type: line.type === "added" ? "add" : line.type === "removed" ? "del" : line.type === "hunk" ? "hunk" : "ctx",
    text: line.content,
  }));
  return {
    rows,
    add: lines.filter((line) => line.type === "added").length,
    del: lines.filter((line) => line.type === "removed").length,
  };
}

const PREVIEW_KEYS = ["command", "path", "pattern", "url", "query"] as const;

function previewOf(args?: Record<string, unknown>): string | undefined {
  for (const key of PREVIEW_KEYS) {
    const value = args?.[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

export interface ToolNodeInput {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  output?: string;
  diff?: string;
  startedAt?: number;
  completedAt?: number;
  failed?: boolean;
  /** Live tools: false while still running. */
  done?: boolean;
}

/** Map one tool call (live or committed) to a blocks trace node. */
export function toolToNode(tool: ToolNodeInput): TraceNode {
  const status = tool.failed ? ("failed" as const) : tool.done === false ? ("running" as const) : ("completed" as const);
  const durationMs = tool.startedAt != null && tool.completedAt != null ? Math.max(0, tool.completedAt - tool.startedAt) : undefined;

  if (tool.name === "run_command" || tool.name === "run_background") {
    return {
      id: tool.id,
      type: "terminal",
      status,
      durationMs,
      command: typeof tool.args?.command === "string" ? tool.args.command : tool.name,
      output: tool.output,
      exitCode: tool.failed ? 1 : 0,
    };
  }
  if ((tool.name === "write_file" || tool.name === "update_file" || tool.name === "apply_patch") && tool.diff) {
    const { rows, add, del } = diffToRows(tool.diff);
    return {
      id: tool.id,
      type: "diffs",
      status,
      durationMs,
      diffFile: typeof tool.args?.path === "string" ? tool.args.path : undefined,
      diffRows: rows,
      add,
      del,
    };
  }
  return {
    id: tool.id,
    type: "tool",
    toolName: tool.name,
    status,
    durationMs,
    args: tool.args,
    primary: previewOf(tool.args),
    output: tool.output,
  };
}

/** Map a recorded thinking block to a reasoning trace node. */
export function thinkingToNode(thinking: { text: string; durationMs?: number }, live = false): TraceNode {
  return {
    type: "reasoning",
    sentences: [thinking.text],
    durationSeconds: thinking.durationMs != null ? thinking.durationMs / 1000 : undefined,
    status: live ? "running" : "completed",
  };
}
