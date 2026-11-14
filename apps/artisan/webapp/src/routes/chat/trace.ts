import type { TraceNode } from "@twodb/blocks";

/** Map artisan tool-call metas (persisted or live) to blocks trace nodes. */

export interface ToolCallMeta {
  id: string;
  name: string;
  args: string | Record<string, unknown>;
  output?: string | null;
  ok?: boolean | null;
  startedAt?: number | null;
  completedAt?: number | null;
}

export interface ThinkingMeta {
  text: string;
  durationMs?: number | null;
  id?: string;
}

function argsOf(a: ToolCallMeta["args"]): Record<string, unknown> {
  if (typeof a === "string") {
    try {
      return JSON.parse(a) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return a ?? {};
}

function previewOf(args: Record<string, unknown>): string | undefined {
  for (const key of ["command", "path", "pattern", "url", "query", "prompt", "name", "jobId"]) {
    const v = args[key];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export function toolToNode(tool: ToolCallMeta, live = false): TraceNode {
  const args = argsOf(tool.args);
  const failed = tool.ok === false;
  const status: TraceNode["status"] = failed ? "failed" : live && tool.output == null ? "running" : "completed";
  const durationMs = tool.startedAt != null && tool.completedAt != null ? Math.max(0, tool.completedAt - tool.startedAt) : undefined;

  if (tool.name === "exec" || tool.name.startsWith("job_")) {
    return {
      id: tool.id,
      type: "terminal",
      status,
      durationMs,
      command: typeof args.command === "string" ? args.command : (typeof args.jobId === "string" ? `${tool.name} ${args.jobId}` : tool.name),
      output: tool.output ?? undefined,
      exitCode: failed ? 1 : 0,
    };
  }
  return {
    id: tool.id,
    type: "tool",
    toolName: tool.name,
    status,
    durationMs,
    args,
    primary: previewOf(args),
    output: tool.output ?? undefined,
  };
}

export function thinkingToNode(thinking: ThinkingMeta, live = false): TraceNode {
  return {
    id: thinking.id ?? "reasoning",
    type: "reasoning",
    sentences: [thinking.text],
    durationSeconds: thinking.durationMs != null ? thinking.durationMs / 1000 : undefined,
    status: live ? "running" : "completed",
  };
}

/** Live tool event (from WS frames) → node. */
export function liveToolToNode(ev: { id: string; name: string; args: Record<string, unknown>; output?: string; ok?: boolean }): TraceNode {
  return toolToNode({ id: ev.id, name: ev.name, args: ev.args, output: ev.output ?? null, ok: ev.ok ?? null }, ev.output === undefined);
}
