import type { ToolContext, ToolSpec } from "../agent-loop.js";
import type { ToolkitClient, ToolkitTool } from "../../toolkit-client.js";

type ToolkitParam = ToolkitTool["params"][string];

/**
 * The toolkit meta-tools — one stable belt of 4 tools regardless of how many
 * MCP servers / connector instances exist. Agents discover by name:
 * `list_tools` → names+descriptions, `search_tool` filters, `describe_tool`
 * returns one tool's parameter shape, `call_tool` executes. Toolkit (not
 * artisan) enforces agent access + space scope + input validation.
 */

const fail = (msg: string) => `error: ${msg}`;

function toolLine(t: ToolkitTool): string {
  return `- ${t.name}: ${t.description}`;
}

async function visibleTools(ctx: ToolContext): Promise<ToolkitTool[]> {
  const tools = await ctx.toolkit.listTools(ctx.session.workspace_id, ctx.agent.id, ctx.session.space_id).catch((err: Error) => {
    throw new Error(`toolkit unavailable: ${err.message}`);
  });
  return tools;
}

export function toolkitTools(toolkit: ToolkitClient): ToolSpec[] {
  return [
    {
      name: "list_tools",
      description:
        "Lists every external tool available to you right now (MCP servers and connectors like Planes), with each tool's name and a one-line description. " +
        "Start here before calling anything. Use search_tool to filter by keyword, describe_tool for a tool's parameters, call_tool to run one.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx) {
        const tools = await visibleTools(ctx);
        if (tools.length === 0) return "no external tools are available to this agent (nothing configured, or none shared with you)";
        const byOwner = new Map<string, ToolkitTool[]>();
        for (const t of tools) {
          const key = t.instanceName;
          byOwner.set(key, [...(byOwner.get(key) ?? []), t]);
        }
        return [...byOwner.entries()]
          .map(([owner, list]) => `${owner}:\n${list.map(toolLine).join("\n")}`)
          .join("\n\n");
      },
    },
    {
      name: "search_tool",
      description:
        "Searches your available external tools by a keyword (matched against the tool name and its description, case-insensitive) and returns the matching tool names with their descriptions.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Keyword(s) to look for in tool names and descriptions" } },
        required: ["query"],
      },
      async execute(args, ctx) {
        const query = String(args.query ?? "").trim().toLowerCase();
        if (!query) return fail("query is required");
        const tools = await visibleTools(ctx);
        const hits = tools.filter((t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query));
        if (hits.length === 0) return `no tools match "${query}" — call list_tools to see everything`;
        return hits.map(toolLine).join("\n");
      },
    },
    {
      name: "describe_tool",
      description:
        "Returns one tool's full request shape: its name, description, every parameter (type, description, whether required, enum options when applicable). Use this before call_tool to build valid input.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Exact tool name from list_tools / search_tool" } },
        required: ["name"],
      },
      async execute(args, ctx) {
        const name = String(args.name ?? "").trim();
        if (!name) return fail("name is required");
        const tools = await visibleTools(ctx);
        const tool = tools.find((t) => t.name === name);
        if (!tool) return fail(`no tool named "${name}" is available to you — call list_tools`);
        const params = Object.entries(tool.params) as Array<[string, ToolkitParam]>;
        if (params.length === 0) return `${tool.name} — ${tool.description}\nparameters: none`;
        const lines = params.map(([key, p]) => {
          const bits = [p.type, p.required ? "required" : "optional"];
          if (p.options?.length) bits.push(`one of: ${p.options.join(", ")}`);
          return `  ${key} (${bits.join(", ")}): ${p.description}`;
        });
        return `${tool.name} — ${tool.description}\nparameters:\n${lines.join("\n")}`;
      },
    },
    {
      name: "call_tool",
      description:
        "Calls an external tool by name and returns its output as JSON text. Only parameters the tool declares (see describe_tool) are accepted; required ones must be present. Output may be truncated for very long results.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Exact tool name from list_tools / search_tool" },
          params: { type: "object", description: "The tool's parameters as an object (keys per describe_tool). Omit for no-parameter tools." },
        },
        required: ["name"],
      },
      async execute(args, ctx) {
        const name = String(args.name ?? "").trim();
        if (!name) return fail("name is required");
        const params = (args.params ?? {}) as Record<string, unknown>;
        if (params === null || typeof params !== "object" || Array.isArray(params)) return fail("params must be an object");
        try {
          const out = await ctx.toolkit.invokeTool(ctx.session.workspace_id, ctx.agent.id, ctx.session.space_id, name, params);
          const text = JSON.stringify(out, null, 2);
          return text === undefined ? "null" : text;
        } catch (err) {
          return fail((err as Error).message);
        }
      },
    },
  ];
}
