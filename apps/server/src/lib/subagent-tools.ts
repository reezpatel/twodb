import { db } from "../auth";
import type { AgentTool } from "./agent";
import { DEFAULT_SKILL_TAG } from "./skills";
import { isSessionRunning, startSessionRun, type SessionRow } from "../routes/code-ws";
import { broadcastToSession } from "../routes/code-ws";
import type { AgentType } from "../plugins/db";

/**
 * Subagent orchestration tools — list/invoke/check-status. Agents invoke other
 * configured agents as headless child code sessions (like /btw, but not
 * interactive): the child inherits the parent's directory + tags, runs with its
 * own prompt/tools, and its final summary returns as the tool output.
 *
 * Permission rules (caller type → allowed target types):
 *   main session      → sub_agent, persona, collaborator
 *   sub_agent         → sub_agent
 *   persona           → sub_agent, persona
 *   collaborator      → sub_agent, persona, collaborator
 * Depth cap: 3 (children of children …). Sentinels are never invocable.
 */

export const MAX_SUBAGENT_DEPTH = 3;

/** What a session of this caller kind may invoke. */
const INVOKABLE_BY: Record<"main" | AgentType, AgentType[]> = {
  main: ["sub_agent", "persona", "collaborator"],
  sub_agent: ["sub_agent"],
  persona: ["sub_agent", "persona"],
  collaborator: ["sub_agent", "persona", "collaborator"],
  sentinel: [],
};

/** The invocable-type rule for a caller: a main session or its bound agent type. */
export function invokableTypesFor(callerAgentType: AgentType | null): AgentType[] {
  return INVOKABLE_BY[callerAgentType ?? "main"];
}

export function canInvoke(callerAgentType: AgentType | null, targetType: AgentType): boolean {
  return invokableTypesFor(callerAgentType).includes(targetType);
}

/** Agents visible to a session: non-sentinel, directory-compatible, and tagged
 * "default" or sharing a session tag — same matching as skills. */
export async function listMatchingSubagents(organizationId: string, codeDirectoryId: string | null, sessionTags: string[], callerAgentType: AgentType | null) {
  const rows = await db
    .selectFrom("agent")
    .select(["id", "description", "provider", "model", "type", "tools", "tags", "codeDirectoryId"])
    .where("organizationId", "=", organizationId)
    .orderBy("createdAt", "asc")
    .execute();
  return rows
    .filter((a) => a.type !== "sentinel")
    .filter((a) => a.codeDirectoryId === null || a.codeDirectoryId === codeDirectoryId)
    .filter((a) => a.tags.includes(DEFAULT_SKILL_TAG) || a.tags.some((t) => sessionTags.includes(t)))
    .filter((a) => canInvoke(callerAgentType, a.type));
}

export const LIST_SUBAGENTS_TOOL: AgentTool = {
  name: "list_subagents",
  description:
    "Lists the subagents available in this session — their agent_id, type, description and tools. Use before invoke_subagent to pick the right one. Agents match when they are tagged 'default' or share a session tag and belong to this workspace.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {},
  },
};

export const INVOKE_SUBAGENT_TOOL: AgentTool = {
  name: "invoke_subagent",
  description:
    "Invokes a subagent with a prompt and waits for its summary. The subagent runs as a headless child session with the same workspace, its own system prompt and tools; its final answer is returned as this tool's output. It cannot ask the user questions. Max nesting depth is 3.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      agent_id: { type: "string", description: "Agent id from list_subagents" },
      prompt: { type: "string", description: "The full task description for the subagent — it sees only this, give it complete context" },
    },
    required: ["agent_id", "prompt"],
  },
};

export const CHECK_SUBAGENT_STATUS_TOOL: AgentTool = {
  name: "check_subagent_status",
  description: "Checks the status of the subagent child sessions this session has invoked — running, done, or failed, plus the summary once finished.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      session_id: { type: "string", description: "The subagent session id returned by invoke_subagent (optional — omit to list all children)" },
    },
  },
};

export const SUBAGENT_TOOLS: AgentTool[] = [LIST_SUBAGENTS_TOOL, INVOKE_SUBAGENT_TOOL, CHECK_SUBAGENT_STATUS_TOOL];

// ---------------------------------------------------------------------------
// Execution — called from the agent loop with the calling session's context.

export interface SubagentContext {
  organizationId: string;
  /** The calling session row. */
  session: SessionRow;
  /** Type of the calling session's bound agent (null = main session). */
  callerAgentType: AgentType | null;
  /** Connection + model the child runs with (the parent's). */
  connectionId: string;
  model: string;
  thinkingLevel?: string | null;
}

export interface SubagentExecution {
  output: string;
  failed: boolean;
}

function agentMatchError(target: { type: string; tags: string[]; codeDirectoryId: string | null }, sessionTags: string[], codeDirectoryId: string | null): string | null {
  if (target.codeDirectoryId !== null && target.codeDirectoryId !== codeDirectoryId) return "agent belongs to a different workspace";
  if (!target.tags.includes(DEFAULT_SKILL_TAG) && !target.tags.some((t) => sessionTags.includes(t))) return "agent tags do not match this session";
  return null;
}

export async function executeListSubagents(ctx: SubagentContext): Promise<SubagentExecution> {
  const agents = await listMatchingSubagents(ctx.organizationId, ctx.session.codeDirectoryId, ctx.session.tags ?? [], ctx.callerAgentType);
  if (agents.length === 0) {
    return { output: "no subagents configured for this session — add agents in Settings → LLM → Agents and tag them 'default' or a session tag", failed: false };
  }
  const lines = agents.map(
    (a) =>
      `- agent_id: ${a.id}\n  type: ${a.type}\n  description: ${a.description ?? `${a.provider}/${a.model}`}\n  tools: ${(a.tools as unknown as string[]).includes("all") ? "all" : (a.tools as unknown as string[]).length ? (a.tools as unknown as string[]).join(", ") : "none"}`,
  );
  return { output: `Subagents available in this session:\n${lines.join("\n")}`, failed: false };
}

/**
 * Spawns the child session and drives it to completion. Returns the child's
 * final assistant message (its "summary") — same contract as /btw send-to-main,
 * but headless: no human in the loop, ask_user disabled.
 */
export async function executeInvokeSubagent(ctx: SubagentContext, agentId: string, prompt: string): Promise<SubagentExecution> {
  const agent = await db
    .selectFrom("agent")
    .selectAll()
    .where("id", "=", agentId)
    .where("organizationId", "=", ctx.organizationId)
    .executeTakeFirst();
  if (!agent) return { output: `error: agent not found: ${agentId}`, failed: true };
  if (agent.type === "sentinel") return { output: "error: sentinel agents cannot be invoked", failed: true };
  if (!canInvoke(ctx.callerAgentType, agent.type)) {
    return { output: `error: a ${ctx.callerAgentType ?? "main"} session cannot invoke a ${agent.type} agent`, failed: true };
  }
  const matchError = agentMatchError(agent, ctx.session.tags ?? [], ctx.session.codeDirectoryId);
  if (matchError) return { output: `error: ${matchError}`, failed: true };

  const parent = ctx.session;
  if (parent.depthCount >= MAX_SUBAGENT_DEPTH) {
    return { output: `error: subagent nesting limit reached (depth ${parent.depthCount}, max ${MAX_SUBAGENT_DEPTH})`, failed: true };
  }

  const now = new Date();
  const child = await db
    .insertInto("code_session")
    .values({
      id: crypto.randomUUID(),
      organizationId: ctx.organizationId,
      title: `${agent.description?.slice(0, 40) ?? agent.type} — ${prompt.slice(0, 30)}`,
      connectionId: ctx.connectionId,
      model: ctx.model,
      // Children inherit the parent's workspace; /btw and tool-invoked alike.
      codeDirectoryId: parent.codeDirectoryId,
      type: "sub_agent",
      parentSessionId: parent.id,
      agentId: agent.id,
      tags: parent.tags ?? [],
      interactive: false,
      depthCount: parent.depthCount + 1,
      runtimeState: null,
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // A clickable block in the parent transcript — the UI can open the child live.
  await db
    .insertInto("code_session_message")
    .values({
      id: crypto.randomUUID(),
      sessionId: parent.id,
      role: "subagent",
      content: prompt,
      meta: { subagentSessionId: child.id, agentName: agent.description ?? agent.type, agentType: agent.type, prompt },
      createdAt: now,
    })
    .execute();
  broadcastToSession(parent.id, { type: "session_updated" });

  // Drive the child to completion on the caller's connection. The run's
  // sockets join from any viewers of the child session (live view in the UI).
  const started = await startSessionRun(ctx.organizationId, { ...child, interactive: false }, prompt, {
    connectionId: ctx.connectionId,
    model: ctx.model,
    thinkingLevel: ctx.thinkingLevel ?? null,
    userMeta: { subagent: { agentName: agent.description ?? agent.type, invokedBy: parent.id } },
  });
  if ("error" in started) {
    return { output: `error: subagent failed to start: ${started.error}`, failed: true };
  }
  if ("busy" in started) {
    return { output: "error: subagent session is already running", failed: true };
  }

  // The child's final assistant message is the summary handed back.
  const rows = await db
    .selectFrom("code_session_message")
    .select(["role", "content"])
    .where("sessionId", "=", child.id)
    .where("role", "=", "assistant")
    .orderBy("createdAt", "desc")
    .execute();
  const summary = rows[0]?.content?.trim();
  if (!summary) return { output: "error: subagent finished without a final answer", failed: true };
  return {
    output: `subagent ${agent.description ?? agent.type} finished (session: ${child.id})\n\n<summary>\n${summary}\n</summary>`,
    failed: false,
  };
}

export async function executeCheckSubagentStatus(ctx: SubagentContext, sessionId: string | undefined): Promise<SubagentExecution> {
  let query = db
    .selectFrom("code_session")
    .select(["id", "title", "agentId", "updatedAt"])
    .where("parentSessionId", "=", ctx.session.id)
    .orderBy("createdAt", "desc");
  if (sessionId) query = query.where("id", "=", sessionId);
  const children = await query.execute();
  if (children.length === 0) return { output: "no subagent sessions invoked from this session yet", failed: false };

  const lines: string[] = [];
  for (const child of children) {
    const running = isSessionRunning(child.id);
    const last = await db
      .selectFrom("code_session_message")
      .select(["role", "content"])
      .where("sessionId", "=", child.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();
    const status = running ? "running" : last?.role === "assistant" ? "done" : "no output yet";
    lines.push(`- session_id: ${child.id}\n  title: ${child.title}\n  status: ${status}${last?.content && !running ? `\n  last message: ${last.content.slice(0, 400)}` : ""}`);
  }
  return { output: `Subagent sessions invoked from this session:\n${lines.join("\n")}`, failed: false };
}