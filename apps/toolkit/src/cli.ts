import { defineAppCli } from "@twodb/core-platform/cli";

/**
 * Toolkit's declared CLI surface. The `tools` command is a listCommand:
 * running it lists every connector tool (GET /tools), and each tool id
 * becomes invocable as `twodb tools <toolId> --param k=v` (or `twodb toolkit
 * tools <toolId>`), mapping to POST /tools/:toolId/invoke with the params
 * under `params` — exactly what the MCP surface invokes.
 */
export const toolkitCli = defineAppCli({
  slug: "toolkit",
  description: "Connector tools (MCP-compatible) — list and invoke from the shell.",
  commands: [
    {
      name: "tools",
      description: "Every connector tool across enabled instances; invoke one by id",
      call: { method: "GET", path: "/tools" },
      listCommand: true,
      idFromList: "id",
      describeItem: "{name} — {description}",
      invoke: { method: "POST", path: "/tools/{id}/invoke", paramsKey: "params" },
    },
  ],
});
