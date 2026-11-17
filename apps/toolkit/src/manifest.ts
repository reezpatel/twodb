import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

const scope = z.object({ all: z.boolean(), ids: z.array(z.string()) });
const mcpTransport = z.enum(["auto", "http", "sse"]);

const mcpOut = z.object({
  id: z.string(), name: z.string(), url: z.string(), transport: mcpTransport, headers: z.record(z.string(), z.string()),
  enabled: z.boolean(), scope, agentIds: z.array(z.string()), createdAt: z.string(), updatedAt: z.string(),
});

const fieldSpec = z.object({
  key: z.string(), label: z.string(), secret: z.boolean().optional(), required: z.boolean().optional(),
  optional: z.boolean().optional(), placeholder: z.string().optional(), help: z.string().optional(),
});
const paramSpec = z.object({
  type: z.enum(["string", "number", "boolean", "enum", "date"]), description: z.string(),
  required: z.boolean().optional(), options: z.array(z.string()).optional(),
});
const templateOut = z.object({
  id: z.string(), name: z.string(), description: z.string(), icon: z.string(), fields: z.array(fieldSpec),
  commands: z.array(z.object({ name: z.string(), description: z.string(), params: z.record(z.string(), paramSpec) })),
  broadcasts: z.array(z.object({ event: z.string(), description: z.string() })),
  pollIntervalMs: z.number().optional(),
});

const instanceOut = z.object({
  id: z.string(), templateId: z.string(), name: z.string(), enabled: z.boolean(), scope, agentIds: z.array(z.string()),
  healthStatus: z.enum(["ok", "error"]).nullable(), healthError: z.string().nullable(), healthCheckedAt: z.string().nullable(),
  /** Secret fields are masked (******); plain fields echo their value. */
  config: z.record(z.string(), z.string()),
  createdAt: z.string(), updatedAt: z.string(),
});

const toolOut = z.object({
  id: z.string(), instanceId: z.string(), instanceName: z.string(), templateId: z.string(),
  name: z.string(), description: z.string(), params: z.record(z.string(), paramSpec),
});

const twodbToolOut = z.object({
  key: z.string(), app: z.string(), appName: z.string(), name: z.string(), description: z.string(), method: z.string(), path: z.string(),
  params: z.array(z.object({
    name: z.string(), in: z.enum(["path", "query", "body"]), type: z.enum(["string", "number", "boolean", "array", "object"]),
    description: z.string(), required: z.boolean(), options: z.array(z.string()).optional(),
  })),
});

const broadcastOut = z.object({
  id: z.string(), instanceId: z.string(), event: z.string(), payload: z.unknown(), createdAt: z.string(),
});

const queueOut = z.object({
  id: z.string(), instanceId: z.string(), name: z.string(), createdBy: z.string().nullable(), createdAt: z.string(), pending: z.number(),
});

const queueItemOut = z.object({
  id: z.string(), queueId: z.string(), event: z.string(), payload: z.unknown(), status: z.string(), createdAt: z.string(), deliveredAt: z.string().nullable(),
});

export const toolkitManifest = defineAppManifest({
  name: "Toolkit",
  slug: "toolkit",
  version: "0.1.0",
  shape: "backend+webapp",
  description: "Central host for external MCP servers and API connectors — connector instances expose invocable tools and background broadcasts (with optional durable queues).",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/toolkit/api",
  endpoints: [
    // --- MCP ----------------------------------------------------------------
    defineEndpoint({
      name: "listMcpServers",
      method: "GET",
      path: "/mcp",
      auth: "session-or-apiKey",
      description: "Lists the workspace's registered external MCP servers.",
      request: z.object({}),
      response: z.array(mcpOut),
    }),
    defineEndpoint({
      name: "createMcpServer",
      method: "POST",
      path: "/mcp",
      auth: "session-or-apiKey",
      description: "Registers an external MCP server (http/sse). Name must be unique in the workspace.",
      request: z.object({
        name: z.string(), url: z.string(), transport: mcpTransport.optional(),
        headers: z.record(z.string(), z.string()).optional(), enabled: z.boolean().optional(),
        scope: scope.optional(), agentIds: z.array(z.string()).optional(),
      }),
      response: mcpOut,
    }),
    defineEndpoint({
      name: "updateMcpServer",
      method: "PATCH",
      path: "/mcp/:id",
      auth: "session-or-apiKey",
      description: "Updates name/url/transport/headers/enabled/scope. Only provided fields change.",
      request: z.object({
        id: z.string(), name: z.string().optional(), url: z.string().optional(), transport: mcpTransport.optional(),
        headers: z.record(z.string(), z.string()).optional(), enabled: z.boolean().optional(), scope: scope.optional(),
        agentIds: z.array(z.string()).optional(),
      }),
      response: mcpOut,
    }),
    defineEndpoint({
      name: "deleteMcpServer",
      method: "DELETE",
      path: "/mcp/:id",
      auth: "session-or-apiKey",
      description: "Removes an MCP server.",
      request: z.object({ id: z.string() }),
      response: z.object({ ok: z.literal(true) }),
    }),
    defineEndpoint({
      name: "importMcpServers",
      method: "POST",
      path: "/mcp/import",
      auth: "session-or-apiKey",
      description: "Bulk-imports the standard `{ \"mcpServers\": { … } }` JSON (VS Code / Claude Desktop / Cursor). stdio entries are skipped.",
      request: z.object({ json: z.unknown(), scope: scope.optional(), agentIds: z.array(z.string()).optional() }),
      response: z.object({
        created: z.array(mcpOut),
        skipped: z.array(z.object({ name: z.string(), reason: z.string() })),
      }),
    }),

    // --- Connector templates + instances ------------------------------------
    defineEndpoint({
      name: "listConnectorTemplates",
      method: "GET",
      path: "/connector-templates",
      auth: "session-or-apiKey",
      description: "The connector template gallery (fields to render config forms, commands, broadcasts).",
      request: z.object({}),
      response: z.array(templateOut),
    }),
    defineEndpoint({
      name: "listConnectorInstances",
      method: "GET",
      path: "/instances",
      auth: "session-or-apiKey",
      description: "Connector instances of the workspace (all templates).",
      request: z.object({ templateId: z.string().optional() }),
      response: z.array(instanceOut),
    }),
    defineEndpoint({
      name: "createConnectorInstance",
      method: "POST",
      path: "/instances",
      auth: "session-or-apiKey",
      description: "Configures a new instance of a connector template. Config values for secret fields are encrypted at rest. Runs healthCheck before saving; a failing check is a 502 unless force=true.",
      request: z.object({
        templateId: z.string(), name: z.string(), config: z.record(z.string(), z.string()),
        enabled: z.boolean().optional(), scope: scope.optional(), agentIds: z.array(z.string()).optional(), force: z.boolean().optional(),
      }),
      response: instanceOut,
    }),
    defineEndpoint({
      name: "getConnectorInstance",
      method: "GET",
      path: "/instances/:id",
      auth: "session-or-apiKey",
      description: "One instance with its tools (commands) — the instance page's payload.",
      request: z.object({ id: z.string() }),
      response: instanceOut.extend({ template: templateOut, tools: z.array(toolOut) }),
    }),
    defineEndpoint({
      name: "updateConnectorInstance",
      method: "PATCH",
      path: "/instances/:id",
      auth: "session-or-apiKey",
      description: "Updates name/config/enabled/scope. Secret fields left masked in the request keep their stored value. Re-runs healthCheck on config changes.",
      request: z.object({
        id: z.string(), name: z.string().optional(), config: z.record(z.string(), z.string()).optional(),
        enabled: z.boolean().optional(), scope: scope.optional(), agentIds: z.array(z.string()).optional(), force: z.boolean().optional(),
      }),
      response: instanceOut,
    }),
    defineEndpoint({
      name: "deleteConnectorInstance",
      method: "DELETE",
      path: "/instances/:id",
      auth: "session-or-apiKey",
      description: "Deletes an instance with its queues and state.",
      request: z.object({ id: z.string() }),
      response: z.object({ ok: z.literal(true) }),
    }),
    defineEndpoint({
      name: "checkInstanceHealth",
      method: "POST",
      path: "/instances/:id/health",
      auth: "session-or-apiKey",
      description: "Runs the template's healthCheck against the stored config and records the outcome.",
      request: z.object({ id: z.string() }),
      response: instanceOut,
    }),
    defineEndpoint({
      name: "runInstancePoll",
      method: "POST",
      path: "/instances/:id/poll",
      auth: "session-or-apiKey",
      description: "Runs one background poll immediately (emits broadcasts for any detected changes).",
      request: z.object({ id: z.string() }),
      response: z.object({ ok: z.literal(true) }),
    }),

    // --- Tools (execution) ----------------------------------------------------
    defineEndpoint({
      name: "listTools",
      method: "GET",
      path: "/tools",
      auth: "session-or-apiKey",
      description: "Every available tool across enabled instances (optionally ?templateId= filters). Tool names are `<instance>_<command>` (slugified instance name — stable, id-free). Trusted app callers (e.g. Artisan) pass ?agentId= (+ x-twodb-space-ids via the gateway) to get only tools that agent may use; without it, the full workspace list returns.",
      request: z.object({ templateId: z.string().optional(), agentId: z.string().optional() }),
      response: z.array(toolOut),
    }),
    defineEndpoint({
      name: "invokeTool",
      method: "POST",
      path: "/tools/:toolId/invoke",
      auth: "session-or-apiKey",
      description: "Invokes a connector tool and returns `{ output }`. toolId is either the id form `<instanceId>.<command>` (webapp) or the agent-facing NAME `<instance>_<command>` — name-form calls should carry ?agentId= (Artisan sends it) so access lists are enforced. Required/number params validated by toolkit.",
      request: z.object({ toolId: z.string(), params: z.record(z.string(), z.unknown()).optional(), agentId: z.string().optional() }),
      response: z.object({ output: z.unknown() }),
    }),
    // --- TwoDB tools (the whole app API surface as agent tools; fixed catalog, per-scope allow-lists) ----------
    defineEndpoint({
      name: "listTwodbTools",
      method: "GET",
      path: "/twodb/tools",
      auth: "session-or-apiKey",
      description: "The full TwoDB tool catalog: one tool per endpoint of every installed app (except toolkit), derived live from the control plane. Used by the configuration page; 403 when called with an agent context.",
      request: z.object({}),
      response: z.array(twodbToolOut),
    }),
    defineEndpoint({
      name: "listTwodbAccess",
      method: "GET",
      path: "/twodb/access",
      auth: "session-or-apiKey",
      description: "Scopes (spaces / agents) that have at least one TwoDB tool enabled, with counts. Default is none.",
      request: z.object({}),
      response: z.array(z.object({ scopeType: z.enum(["space", "agent"]), scopeId: z.string(), count: z.number() })),
    }),
    defineEndpoint({
      name: "getTwodbAccess",
      method: "GET",
      path: "/twodb/access/:scopeType/:scopeId",
      auth: "session-or-apiKey",
      description: "The `<app>/<tool>` keys enabled for one scope (scopeType = space | agent).",
      request: z.object({ scopeType: z.enum(["space", "agent"]), scopeId: z.string() }),
      response: z.object({ scopeType: z.string(), scopeId: z.string(), tools: z.array(z.string()) }),
    }),
    defineEndpoint({
      name: "setTwodbAccess",
      method: "PUT",
      path: "/twodb/access/:scopeType/:scopeId",
      auth: "session-or-apiKey",
      description: "Replaces the enabled TwoDB tools of one scope. Keys must exist in the catalog (400 otherwise); an empty list clears the scope. A tool is callable when enabled for the calling agent OR for the space of the call.",
      request: z.object({ scopeType: z.enum(["space", "agent"]), scopeId: z.string(), tools: z.array(z.string()) }),
      response: z.object({ scopeType: z.string(), scopeId: z.string(), tools: z.array(z.string()) }),
    }),
    defineEndpoint({
      name: "listTwodbApps",
      method: "GET",
      path: "/twodb/apps",
      auth: "session-or-apiKey",
      description: "Agent-facing (needs ?agentId= + the call's space via x-twodb-space-ids or ?spaceId=): the apps that have at least one TwoDB tool enabled for this agent or space, with tool counts.",
      request: z.object({ agentId: z.string(), spaceId: z.string().optional() }),
      response: z.array(z.object({ slug: z.string(), name: z.string(), tools: z.number() })),
    }),
    defineEndpoint({
      name: "listTwodbAppTools",
      method: "GET",
      path: "/twodb/apps/:app/tools",
      auth: "session-or-apiKey",
      description: "Agent-facing: one app's enabled tools (name, HTTP method, description) — no parameter schemas, to keep context small.",
      request: z.object({ app: z.string(), agentId: z.string(), spaceId: z.string().optional() }),
      response: z.array(z.object({ name: z.string(), method: z.string(), description: z.string() })),
    }),
    defineEndpoint({
      name: "getTwodbAppTool",
      method: "GET",
      path: "/twodb/apps/:app/tools/:tool",
      auth: "session-or-apiKey",
      description: "Agent-facing: one enabled tool with its full parameter list (location, type, required, options). 404 when not enabled.",
      request: z.object({ app: z.string(), tool: z.string(), agentId: z.string(), spaceId: z.string().optional() }),
      response: twodbToolOut,
    }),
    defineEndpoint({
      name: "invokeTwodbAppTool",
      method: "POST",
      path: "/twodb/apps/:app/tools/:tool/invoke",
      auth: "session-or-apiKey",
      description: "Agent-facing: runs an enabled tool and returns `{ output }`. Toolkit acts machine-to-machine through the gateway in the workspace, attaching the call's space (x-twodb-space-ids). Params are validated against the tool (400); a tool not enabled for the agent or space answers 403; the app's own error status is passed through.",
      request: z.object({ app: z.string(), tool: z.string(), params: z.record(z.string(), z.unknown()).optional(), agentId: z.string(), spaceId: z.string().optional() }),
      response: z.object({ output: z.unknown() }),
    }),

    defineEndpoint({
      name: "listAgents",
      method: "GET",
      path: "/agents",
      auth: "session-or-apiKey",
      description: "Proxies Artisan's agent list (id, name, type, description) for the workspace — the catalog the access picker builds from. 502 when Artisan is unreachable.",
      request: z.object({}),
      response: z.object({ agents: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), description: z.string().nullable() })) }),
    }),

    // --- Broadcasts -----------------------------------------------------------
    defineEndpoint({
      name: "listBroadcasts",
      method: "GET",
      path: "/events",
      auth: "session-or-apiKey",
      description: "Recent broadcast events (newest first). ?instanceId=, ?event=, ?since= (ISO ts), ?limit=.",
      request: z.object({ instanceId: z.string().optional(), event: z.string().optional(), since: z.string().optional(), limit: z.string().optional() }),
      response: z.object({ events: z.array(broadcastOut) }),
    }),
    defineEndpoint({
      name: "streamBroadcasts",
      method: "GET",
      path: "/events/stream",
      auth: "session-or-apiKey",
      description: "Server-sent events of broadcasts as they are emitted (one SSE `data:` line per event). Same filters as /events for the initial snapshot behavior — stream emits only new events.",
      request: z.object({ instanceId: z.string().optional(), event: z.string().optional() }),
      response: z.unknown(),
    }),

    // --- Queues (durable broadcast consumption) -------------------------------
    defineEndpoint({
      name: "listQueues",
      method: "GET",
      path: "/queues",
      auth: "session-or-apiKey",
      description: "Queues of the workspace (optionally ?instanceId=) with pending counts.",
      request: z.object({ instanceId: z.string().optional() }),
      response: z.object({ queues: z.array(queueOut) }),
    }),
    defineEndpoint({
      name: "createQueue",
      method: "POST",
      path: "/queues",
      auth: "session-or-apiKey",
      description: "Requests a named durable queue for an instance's broadcasts — every emitted event is also inserted, so nothing is lost when a live broadcast is dropped. Idempotent per (instance, name).",
      request: z.object({ instanceId: z.string(), name: z.string() }),
      response: queueOut,
    }),
    defineEndpoint({
      name: "deleteQueue",
      method: "DELETE",
      path: "/queues/:instanceId/:name",
      auth: "session-or-apiKey",
      description: "Deletes a queue and its undelivered items.",
      request: z.object({ instanceId: z.string(), name: z.string() }),
      response: z.object({ ok: z.literal(true) }),
    }),
    defineEndpoint({
      name: "nextQueueItem",
      method: "POST",
      path: "/queues/:instanceId/:name/next",
      auth: "session-or-apiKey",
      description: "Claims the oldest pending item (marks it delivered). 204-style empty result when the queue is drained — { item: null }.",
      request: z.object({ instanceId: z.string(), name: z.string() }),
      response: z.object({ item: queueItemOut.nullable() }),
    }),
    defineEndpoint({
      name: "peekQueue",
      method: "GET",
      path: "/queues/:instanceId/:name/peek",
      auth: "session-or-apiKey",
      description: "Looks at up to ?limit= items (default 20) without claiming them.",
      request: z.object({ instanceId: z.string(), name: z.string(), limit: z.string().optional() }),
      response: z.object({ items: z.array(queueItemOut) }),
    }),
  ],
});

export default toolkitManifest;
