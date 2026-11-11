import type { ToolContext } from "../agent-loop.js";
import { runAgentLoop, MAX_DEPTH, type RunDeps } from "../agent-loop.js";
import { canInvoke } from "./subagents.js";
import { parseJson } from "../../db/repository.js";

/** Shared shape subagent tool modules need. */
export interface RunContext {
  deps: RunDeps;
  dispatch: RunDeps["dispatch"];
  repo: RunDeps["repo"];
  tools: import("../agent-loop.js").ToolSpec[];
}

/**
 * invoke_subagent execution: spawns a child session (parent_session_id set),
 * runs the full agent loop headless, returns the final assistant message.
 * Ad-hoc (prompt-only) children inherit the caller's model + tools.
 */
export async function executeSubagentTool(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const agentId = args.agent_id ? String(args.agent_id) : null;
  const prompt = String(args.prompt ?? "");
  if (!prompt) return "prompt required";

  const deps = ctx.deps;
  const callerType = ctx.agent.type === "directory" ? "main" : ctx.agent.type;
  const callerTags = parseJson<string[]>(ctx.agent.tags_json, ["default"]);

  let targetAgent: import("../../db/schema.js").AgentRow | undefined;
  let model = ctx.model;
  let runner = ctx.session.runner;
  let directory = ctx.session.directory;
  let instruction = "";
  let toolsAllow: string[] | null = null;

  if (agentId) {
    const agent = await deps.repo.getAgent(ctx.session.workspace_id, agentId);
    if (!agent) return `unknown agent_id ${agentId}`;
    if (!canInvoke(callerType, agent.type)) return `cannot invoke ${agent.type} from a ${callerType} session`;
    if (agent.space_id !== ctx.session.space_id) return "agent belongs to a different space";
    // tag visibility
    const tags = parseJson<string[]>(agent.tags_json, ["default"]);
    if (!(tags.includes("default") || tags.some((t) => callerTags.includes(t)))) return "agent not visible in this session";
    targetAgent = agent;
    model = agent.model ?? ctx.model;
    if (agent.runner) runner = agent.runner;
    if (agent.directory) directory = agent.directory;
    instruction = agent.instruction;
    const allow = parseJson<string[]>(agent.tools_json, []);
    const mine = parseJson<string[]>(ctx.agent.tools_json, []);
    toolsAllow = mine.length === 0 ? allow : allow.length === 0 ? mine : allow.filter((t) => mine.includes(t));
  }

  if (ctx.session.depth >= MAX_DEPTH) return `subagent depth cap (${MAX_DEPTH}) reached`;

  const childSession = await deps.repo.createSession({
    workspaceId: ctx.session.workspace_id,
    spaceId: ctx.session.space_id,
    type: "subagent",
    title: agentId ? `${targetAgent?.name ?? "subagent"} (child)` : `adhoc (child)`,
    runner,
    directory,
    model,
    interactive: false,
    agentId,
    parentSessionId: ctx.session.id,
    adhocPrompt: agentId ? null : prompt,
    depth: ctx.session.depth + 1,
  });

  // Child agent row for the loop: reuse target config or synthesize ad-hoc.
  const childAgent: import("../../db/schema.js").AgentRow = targetAgent ?? {
    ...(ctx.agent),
    id: "adhoc",
    name: "adhoc-subagent",
    type: "sub_agent",
    instruction,
    model: null,
    tools_json: JSON.stringify(toolsAllow ?? parseJson<string[]>(ctx.agent.tools_json, [])),
    runner: null,
    directory: null,
  };

  // For configured agents, honor their own allowlist.
  if (targetAgent) {
    childAgent.tools_json = toolsAllow ? JSON.stringify(toolsAllow) : targetAgent.tools_json;
  }

  // Buffer child frames → the tool result (children stream to their parent,
  // not to a room; the UI can still watch via the session endpoint).
  let finalMessage = "";
  await runAgentLoop({
    deps,
    session: childSession,
    agent: childAgent,
    model,
    apiKey: (ctx as ToolContext & { apiKey?: string }).apiKey ?? "",
    emitOverride: (frame) => {
      if (frame.type === "delta") finalMessage += String(frame.text ?? "");
      if (frame.type === "done") {
        // finalMessage already accumulated deltas
      }
    },
  });

  // The loop's final assistant message is the summary.
  const msgs = await deps.repo.listSessionMessages(childSession.id);
  const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.content.trim());
  const summary = last?.content ?? finalMessage ?? "(no output)";
  return summary.slice(0, 30_000);
}
