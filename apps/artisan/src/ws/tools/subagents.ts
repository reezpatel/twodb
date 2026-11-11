import type { ToolSpec } from "../agent-loop.js";
import { parseJson } from "../../db/repository.js";
import { executeSubagentTool } from "./execute.js";

/**
 * Subagent tools — list/invoke/check. Invoke takes either an existing agent
 * (agent_id) or an ad-hoc spec (prompt only — same model/tools/directory).
 */

export function subagentTools(): ToolSpec[] {
  return [
    {
      name: "list_subagents",
      description: "Lists available subagents: agent_id, type, description, tools. Use before invoke_subagent.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx) {
        const agents = await ctx.repo.listAgents(ctx.session.workspace_id, ctx.session.space_id);
        const callerType = ctx.agent.type === "directory" ? "main" : ctx.agent.type;
        const invokable = invokableTypesFor(callerType);
        const matching = agents.filter((a) => {
          if (a.type === "directory") return false;
          if (!invokable.includes(a.type)) return false;
          const tags = parseJson<string[]>(a.tags_json, ["default"]);
          const myTags = parseJson<string[]>(ctx.agent.tags_json, ["default"]);
          return tags.includes("default") || tags.some((t) => myTags.includes(t));
        });
        if (!matching.length) return "no subagents available";
        return matching.map((a) => `- ${a.name} (${a.type}): ${a.description || "(no description)"}`).join("\n");
      },
    },
    {
      name: "invoke_subagent",
      description:
        "Invokes a subagent with a full task description (it sees only your prompt, not the conversation). " +
        "Either agent_id (a configured agent from list_subagents) or prompt-only for an ad-hoc subagent " +
        "with your model and tools. Returns the subagent's final summary. Runs synchronously.",
      parameters: {
        type: "object",
        properties: {
          agent_id: { type: "string", description: "existing agent id from list_subagents" },
          prompt: { type: "string", description: "the complete task for the subagent" },
        },
        required: ["prompt"],
      },
      async execute(args, ctx) {
        return executeSubagentTool(args, ctx);
      },
    },
    {
      name: "check_subagent_status",
      description: "Checks a previously invoked subagent's session state (running/finished + last message).",
      parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] },
      async execute(args, ctx) {
        const child = await ctx.repo.getSession(ctx.session.workspace_id, String(args.sessionId));
        if (!child) return "unknown session";
        const msgs = await ctx.repo.listSessionMessages(child.id);
        const last = msgs[msgs.length - 1];
        return JSON.stringify({
          title: child.title, running: false /* best-effort: the loop map is per-process */,
          lastMessage: last ? { role: last.role, content: last.content.slice(0, 2000) } : null,
        });
      },
    },
  ];
}

/** Caller type → allowed target types (directory agents act as "main"). */
const INVOKABLE_BY: Record<string, string[]> = {
  main: ["sub_agent", "persona", "collaborator"],
  sub_agent: ["sub_agent"],
  persona: ["sub_agent", "persona"],
  collaborator: ["sub_agent", "persona", "collaborator"],
};

export function invokableTypesFor(callerType: string): string[] {
  return INVOKABLE_BY[callerType] ?? ["sub_agent"];
}

export function canInvoke(callerType: string, targetType: string): boolean {
  return invokableTypesFor(callerType).includes(targetType);
}
