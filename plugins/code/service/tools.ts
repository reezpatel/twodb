import type { TwodbTool, TwodbToolCall } from "@twodb/contracts";

export type ToolContext = {
  nodeId: string;
  folder: string;
  invoke: <T>(name: string, ...args: unknown[]) => Promise<T>;
};

export type ToolResult = { ok: boolean; output: string };

const OUTPUT_LIMIT = 8 * 1024;

const truncate = (output: string): string => (output.length > OUTPUT_LIMIT ? `${output.slice(0, OUTPUT_LIMIT)}\n… [truncated]` : output);

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

const poll = async <T>(tick: () => Promise<T>, isSettled: (state: T) => boolean, timeoutMs: number): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await tick();
    if (isSettled(state)) return state;
    if (Date.now() >= deadline) return state;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

export const toolDefinitions: TwodbTool[] = [
  {
    type: "function",
    function: {
      name: "read",
      description: "Read a UTF-8 text file (relative to the session folder). Output is truncated at 8kB.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the session folder" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Create or fully overwrite a file with the given content (relative to the session folder).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the session folder" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch",
      description: 'Splice lines into a file. Line numbers are 0-based over content.split("\\n"). Ops apply high-index first.',
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to the session folder" },
          ops: {
            type: "array",
            description: "Line splices: {start, delete_count, lines}",
            items: {
              type: "object",
              properties: {
                start: { type: "integer" },
                delete_count: { type: "integer" },
                lines: { type: "array", items: { type: "string" } },
              },
              required: ["start", "delete_count", "lines"],
            },
          },
        },
        required: ["path", "ops"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "command",
      description: "Run a shell command in the session folder and return combined output.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          timeout_ms: { type: "integer", description: "Default 60000, max 600000" },
        },
        required: ["command"],
      },
    },
  },
];

const runCommand = async (ctx: ToolContext, command: string, timeoutMs: number): Promise<ToolResult> => {
  const { commandId } = await ctx.invoke<{ commandId: string }>("node.runCommand", {
    nodeId: ctx.nodeId,
    command,
    cwd: ctx.folder,
    timeoutMs,
  });
  const status = await poll(
    () => ctx.invoke<{ command: { status: string; exit_code: number | null; error: string | null }; output: string } | null>("node.commandStatus", commandId),
    (state) => state != null && state.command.status !== "queued" && state.command.status !== "running",
    timeoutMs + 5_000,
  );
  if (!status) return { ok: false, output: "command status unavailable" };
  const { command: cmd, output } = status;
  if (cmd.status === "error") return { ok: false, output: cmd.error ?? "command error" };
  if (cmd.status === "timeout") return { ok: false, output: "command timed out" };
  if (cmd.exit_code != null && cmd.exit_code !== 0) {
    return { ok: false, output: truncate(`exit ${cmd.exit_code}\n${output}`) };
  }
  return { ok: true, output: truncate(output) };
};

const applyPatch = async (
  ctx: ToolContext,
  path: string,
  baseHash: string | null,
  ops: Array<{ start: number; delete_count: number; lines: string[] }>,
): Promise<ToolResult> => {
  const { patchId } = await ctx.invoke<{ patchId: string }>("node.patch", {
    nodeId: ctx.nodeId,
    path,
    baseHash,
    ops,
  });
  const status = await poll(
    () => ctx.invoke<{ status: string; hash: string | null; error: string | null } | null>("node.patchStatus", patchId),
    (state) => state != null && state.status !== "pending",
    15_000,
  );
  if (!status) return { ok: false, output: "patch status unavailable" };
  if (status.status !== "applied") return { ok: false, output: status.error ?? "patch failed" };
  return { ok: true, output: status.hash ? `applied (sha256 ${status.hash.slice(0, 12)})` : "applied" };
};

export async function executeTool(ctx: ToolContext, call: TwodbToolCall): Promise<ToolResult> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
  } catch {
    return { ok: false, output: `invalid tool arguments json: ${call.function.arguments.slice(0, 200)}` };
  }

  try {
    switch (call.function.name) {
      case "read": {
        const path = String(args.path ?? "");
        return runCommand(ctx, `cat ${shellQuote(path)}`, 15_000);
      }
      case "write": {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        return applyPatch(ctx, path, null, [{ start: 0, delete_count: 1_000_000_000, lines: content.split("\n") }]);
      }
      case "patch": {
        const path = String(args.path ?? "");
        const ops = Array.isArray(args.ops) ? (args.ops as Array<{ start: number; delete_count: number; lines: string[] }>) : [];
        return applyPatch(ctx, path, null, ops);
      }
      case "command": {
        const command = String(args.command ?? "");
        const timeout = Math.min(Math.max(Number(args.timeout_ms) || 60_000, 1_000), 600_000);
        return runCommand(ctx, command, timeout);
      }
      default:
        return { ok: false, output: `unknown tool: ${call.function.name}` };
    }
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}
