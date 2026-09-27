import type { AgentTool, AgentToolCall } from "./agent";
import { runnerManager } from "./runner-manager";

export type ToolOutputSink = (stream: "stdout" | "stderr", data: string) => void;

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "run_command",
    description: "Runs a shell command on the session's assigned runner machine. Returns exit code, stdout and stderr.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run" },
      },
      required: ["command"],
    },
  },
];

const MAX_OUTPUT = 8000;

export async function executeToolCall(
  runnerId: string | null,
  call: AgentToolCall,
  onChunk?: ToolOutputSink,
  onWaiting?: () => void,
): Promise<string> {
  if (call.name !== "run_command") return `error: unknown tool "${call.name}"`;
  if (!runnerId) return "error: no runner assigned to this session";

  const command = typeof call.arguments.command === "string" ? call.arguments.command : "";
  if (!command.trim()) return "error: empty command";

  try {
    const result = await runnerManager.execOnRunner(runnerId, command, onChunk, { onWaiting });
    const text = `exit code: ${result.code}\n\nstdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`;
    return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…(truncated)` : text;
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}
