import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import { webappRewriteUrl, registerWebapp, webappDist } from "@twodb/twodb-core/webapp";
import { createPgDb } from "@twodb/core-data/db";
import { createAsyncEngine } from "@twodb/core-async/engine";

import { toolkitManifest } from "./manifest.js";
import type { ToolkitConfig } from "./config.js";
import { applySchema, type ToolkitDb } from "./db/schema.js";
import { createToolkitRepo, type ToolkitRepo } from "./db/repository.js";
import { readForwardedContext, type ForwardedContext } from "./gateway-context.js";
import { MCP_TRANSPORTS, NAME_RE, validUrl, parseHeaders, parseMcpServersJson, validateScope, type McpTransport } from "./mcp.js";
import { listTemplates, getTemplate } from "./connectors/registry.js";
import type { ConnectorTemplate, ConnectorRuntime } from "./connectors/types.js";
import { startPoller } from "./poller.js";
import { decryptSecret } from "./crypto.js";
import { slugifyOwner, connectorToolName, agentCanUse, TOOL_NAME_RE } from "./tool-names.js";
import { deriveTools, buildCall, isAllowed, type CatalogApp, type TwoDbTool } from "./twodb-tools.js";
import type { Selectable } from "kysely";
import type { McpServerRow, ConnectorInstanceRow } from "./db/schema.js";

const MASK = "••••••••";

/** Artisan's app slug (agent catalog source, called via the gateway). */
const ARTISAN_APP = "artisan";

function mcpOut(row: Selectable<McpServerRow>) {
  return {
    id: row.id, name: row.name, url: row.url, transport: row.transport as McpTransport,
    headers: JSON.parse(row.headers_json) as Record<string, string>,
    enabled: Number(row.enabled) === 1,
    scope: { all: Number(row.scope_all) === 1, ids: JSON.parse(row.scope_ids_json) as string[] },
    agentIds: JSON.parse(row.agent_ids_json ?? "[]") as string[],
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function configOut(template: ConnectorTemplate, row: Selectable<ConnectorInstanceRow>): Record<string, string> {
  const stored = JSON.parse(row.config_json) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const field of template.fields) out[field.key] = field.secret ? MASK : (stored[field.key] ?? "");
  return out;
}

function instanceOut(repo: ToolkitRepo, row: Selectable<ConnectorInstanceRow>) {
  const template = getTemplate(row.template_id)!;
  return {
    id: row.id, templateId: row.template_id, name: row.name, enabled: Number(row.enabled) === 1,
    scope: { all: Number(row.scope_all) === 1, ids: JSON.parse(row.scope_ids_json) as string[] },
    agentIds: JSON.parse(row.agent_ids_json ?? "[]") as string[],
    healthStatus: row.health_status, healthError: row.health_error,
    healthCheckedAt: row.health_checked_at ? new Date(row.health_checked_at).toISOString() : null,
    config: configOut(template, row),
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toolsOf(row: Selectable<ConnectorInstanceRow>, template: ConnectorTemplate) {
  return template.commands.map((cmd) => ({
    id: `${row.id}.${cmd.name}`, instanceId: row.id, instanceName: row.name, templateId: template.id,
    name: connectorToolName(row.name, cmd.name), description: cmd.description, params: cmd.params,
  }));
}

/** What buildServer needs from the connected twodb runtime (absent in tests / TOOLKIT_DEV_DIRECT without a control plane). */
export interface ToolkitPlatform {
  gatewayFetch(path: string, init?: RequestInit): Promise<Response>;
  serviceFetch(audience: string, workspaceId: string, path: string, init?: RequestInit & { scopes?: string[] }): Promise<Response>;
}

export async function buildServer(config: ToolkitConfig, platform?: ToolkitPlatform) {
  const app = Fastify({ rewriteUrl: webappRewriteUrl, logger: true });
  const db = createPgDb<ToolkitDb>({ connectionString: config.DATABASE_URL, schema: "toolkit" });
  await applySchema(db);
  const dataKey = config.TWODB_DATA_KEY ?? "dev-only-data-key";
  const repo = createToolkitRepo(db, dataKey);

  // core-async engine: pg_notify broadcast channel for connector events.
  const asyncEngine = createAsyncEngine({ connectionString: config.DATABASE_URL, schema: "toolkit" });
  await asyncEngine.init();

  // In-process SSE subscribers (per connection filters).
  const sseSubscribers = new Set<(msg: { event: string; payload: any }) => void>();

  /**
   * The single fan-out path for connector broadcasts:
   *  1. insert into broadcast log (backlog for /events + SSE snapshot),
   *  2. pg_notify on the core-async workspace channel (cross-app),
   *  3. insert into every requested queue (durable — broadcasts can drop),
   *  4. push to live SSE subscribers.
   */
  const publishBroadcast = async (workspaceId: string, instanceId: string, event: string, payload: unknown) => {
    try {
      await repo.broadcasts.insert(workspaceId, instanceId, event, payload);
    } catch (err) {
      app.log.warn({ err }, "broadcast log insert failed");
    }
    const instanceRow = await repo.instances.get(workspaceId, instanceId);
    const envelope = { instanceId, templateId: instanceRow?.template_id ?? "unknown", event, payload, at: new Date().toISOString() };
    try {
      await asyncEngine.broadcast.publish("toolkit.connector.event", { workspaceId, ...envelope });
    } catch (err) {
      app.log.warn({ err }, "pg_notify publish failed");
    }
    for (const q of await repo.queues.list(workspaceId, instanceId)) {
      try {
        await repo.queues.insert(q.id, workspaceId, event, payload);
      } catch (err) {
        app.log.warn({ err, queue: q.name }, "queue insert failed");
      }
    }
    for (const sub of sseSubscribers) {
      try { sub({ event, payload: envelope }); } catch { /* subscriber gone */ }
    }
  };

  const auth = (req: FastifyRequest, reply: FastifyReply): ForwardedContext | null => {
    const ctx = readForwardedContext(req);
    if (!ctx) { void reply.code(401).send({ error: "unauthorized" }); return null; }
    return ctx;
  };

  /**
   * Agent context: a trusted caller (the gateway, verified app like Artisan)
   * may pass ?agentId= / x-twodb-agent-id plus spaceIds to have tools
   * filtered by each tool-owner's agent access list. User-facing routes
   * (the toolkit webapp) never set it — they see everything in the workspace.
   */
  const agentCtxOf = (req: FastifyRequest): { agentId: string; spaceIds: string[] } | null => {
    const h = req.headers["x-twodb-agent-id"] as string | undefined;
    const q = (req.query as Record<string, string | undefined> | undefined)?.agentId;
    const agentId = (h ?? q ?? "").trim();
    if (!agentId) return null;
    const spacesHeader = req.headers["x-twodb-space-ids"] as string | undefined;
    return { agentId, spaceIds: spacesHeader ? spacesHeader.split(",") : [] };
  };

  const parseAgentIds = (raw: unknown): string[] | { error: string } => {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) return { error: "agentIds must be an array of agent ids" };
    const ids = raw.map(String).map((s) => s.trim()).filter(Boolean);
    if (ids.length !== new Set(ids).size) return { error: "agentIds contains duplicates" };
    return ids;
  };

  /** Enforce owner-name uniqueness per workspace: two connector instances (or
   *  two MCP servers) whose slugified names collide would produce colliding
   *  tool names — reject the second one early with a clear message. */
  const ownerSlugTaken = async (kind: "connector" | "mcp", workspaceId: string, name: string, exceptId?: string): Promise<string | null> => {
    const slug = slugifyOwner(name);
    if (kind === "mcp") {
      const rows = await repo.mcp.list(workspaceId);
      const hit = rows.find((r) => r.id !== exceptId && slugifyOwner(r.name) === slug);
      return hit ? `an MCP server named "${hit.name}" already produces tool names starting with "${slug}_"` : null;
    }
    const rows = await repo.instances.list(workspaceId);
    const hit = rows.find((r) => r.id !== exceptId && slugifyOwner(r.name) === slug);
    return hit ? `an instance named "${hit.name}" already produces tool names starting with "${slug}_"` : null;
  };

  const parseScope = (raw: unknown): { all: boolean; ids: string[] } | { error: string } => {
    const r = (raw ?? {}) as { all?: unknown; ids?: unknown };
    const scope = { all: r.all === undefined ? true : Boolean(r.all), ids: Array.isArray(r.ids) ? r.ids.map(String) : [] };
    const err = validateScope(scope);
    return err ? { error: err } : scope;
  };

  /** Build the runtime used by command execution + manual poll runs. */
  const makeRuntime = (row: Selectable<ConnectorInstanceRow>, decryptedConfig: Record<string, string>): ConnectorRuntime => ({
    config: decryptedConfig,
    async getState() {
      const s = await repo.state.get(row.id);
      if (!s) return null;
      try { return JSON.parse(s.state_json); } catch { return null; }
    },
    async setState(state) { await repo.state.set(row.workspace_id, row.id, JSON.stringify(state)); },
    async emit(event, payload) { await publishBroadcast(row.workspace_id, row.id, event, payload); },
    log: (m) => app.log.info({ instance: row.name }, m),
  });

  /** Decrypt stored config for an instance row (server-side only). */
  const decryptConfig = (template: ConnectorTemplate, row: Selectable<ConnectorInstanceRow>): Record<string, string> => {
    const stored = JSON.parse(row.config_json) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(stored)) {
      const field = template.fields.find((f) => f.key === k);
      out[k] = field?.secret ? decryptSecret(v, dataKey) : v;
    }
    return out;
  };

  /** Validate incoming config against template fields; masked values keep stored secrets. */
  const resolveConfig = (template: ConnectorTemplate, row: Selectable<ConnectorInstanceRow>, incoming: Record<string, string>) => {
    const merged: Record<string, string> = { ...decryptConfig(template, row) };
    for (const field of template.fields) {
      const v = incoming[field.key];
      if (v === undefined || v === MASK) continue;
      merged[field.key] = String(v).trim();
    }
    for (const field of template.fields) {
      if (field.required !== false && !field.optional && !String(merged[field.key] ?? "").trim()) return { error: `field "${field.label}" is required` };
    }
    return { config: merged };
  };

  app.get("/healthz", async () => ({ ok: true, app: toolkitManifest.slug }));

  // ========================================================== MCP ==========
  app.get("/mcp", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    return (await repo.mcp.list(ctx.workspaceId)).map(mcpOut);
  });

  app.post("/mcp", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const b = req.body as { name?: string; url?: string; transport?: string; headers?: unknown; enabled?: boolean; scope?: unknown; agentIds?: unknown };
    const name = (b.name ?? "").trim();
    if (!NAME_RE.test(name)) return reply.code(400).send({ error: "name must be letters, digits, _ or - (no spaces)" });
    const url = validUrl(b.url);
    if (!url) return reply.code(400).send({ error: "a valid http(s) url is required" });
    const transport = (b.transport ?? "auto") as string;
    if (!(MCP_TRANSPORTS as readonly string[]).includes(transport)) return reply.code(400).send({ error: "transport must be auto, http or sse" });
    const headers = parseHeaders(b.headers);
    if (headers === "invalid") return reply.code(400).send({ error: "headers must be a flat string→string object" });
    const scope = parseScope(b.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    const agentIds = parseAgentIds(b.agentIds);
    if ("error" in agentIds) return reply.code(400).send({ error: agentIds.error });
    const slugTaken = await ownerSlugTaken("mcp", ctx.workspaceId, name);
    if (slugTaken) return reply.code(409).send({ error: slugTaken });
    if (await repo.mcp.getByName(ctx.workspaceId, name)) return reply.code(409).send({ error: `an MCP server named "${name}" already exists` });
    const row = await repo.mcp.create({ workspaceId: ctx.workspaceId, name, url, transport, headers: headers ?? {}, enabled: b.enabled !== false, scopeAll: scope.all, scopeIds: scope.ids, agentIds });
    return reply.code(201).send(mcpOut(row));
  });

  app.patch("/mcp/:id", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    if (!(await repo.mcp.get(ctx.workspaceId, id))) return reply.code(404).send({ error: "not found" });
    const b = req.body as Record<string, unknown>;
    const patch: Parameters<typeof repo.mcp.update>[2] = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!NAME_RE.test(name)) return reply.code(400).send({ error: "name must be letters, digits, _ or - (no spaces)" });
      const taken = await repo.mcp.getByName(ctx.workspaceId, name);
      if (taken && taken.id !== id) return reply.code(409).send({ error: `an MCP server named "${name}" already exists` });
      const slugTaken = await ownerSlugTaken("mcp", ctx.workspaceId, name, id);
      if (slugTaken) return reply.code(409).send({ error: slugTaken });
      patch.name = name;
    }
    if (b.url !== undefined) {
      const url = validUrl(b.url);
      if (!url) return reply.code(400).send({ error: "a valid http(s) url is required" });
      patch.url = url;
    }
    if (b.transport !== undefined) {
      if (!(MCP_TRANSPORTS as readonly string[]).includes(String(b.transport))) return reply.code(400).send({ error: "transport must be auto, http or sse" });
      patch.transport = String(b.transport);
    }
    if (b.headers !== undefined) {
      const headers = parseHeaders(b.headers);
      if (headers === "invalid") return reply.code(400).send({ error: "headers must be a flat string→string object" });
      patch.headers_json = JSON.stringify(headers ?? {});
    }
    if (b.enabled !== undefined) patch.enabled = b.enabled ? 1 : 0;
    if (b.scope !== undefined) {
      const scope = parseScope(b.scope);
      if ("error" in scope) return reply.code(400).send({ error: scope.error });
      patch.scope_mode = scope.all ? "all" : "spaces"; patch.scope_all = scope.all ? 1 : 0; patch.scope_ids_json = JSON.stringify(scope.ids);
    }
    if (b.agentIds !== undefined) {
      const agentIds = parseAgentIds(b.agentIds);
      if ("error" in agentIds) return reply.code(400).send({ error: agentIds.error });
      patch.agent_ids_json = JSON.stringify(agentIds);
    }
    const row = await repo.mcp.update(ctx.workspaceId, id, patch);
    return row ? mcpOut(row) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/mcp/:id", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    if (!(await repo.mcp.get(ctx.workspaceId, id))) return reply.code(404).send({ error: "not found" });
    await repo.mcp.remove(ctx.workspaceId, id);
    return { ok: true };
  });

  app.post("/mcp/import", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const b = req.body as { json?: unknown; scope?: unknown; agentIds?: unknown };
    const parsed = parseMcpServersJson(b.json);
    if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
    const scope = parseScope(b.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    const agentIds = parseAgentIds(b.agentIds);
    if ("error" in agentIds) return reply.code(400).send({ error: agentIds.error });
    const created: ReturnType<typeof mcpOut>[] = [];
    const skipped = [...parsed.skipped];
    for (const draft of parsed.drafts) {
      if (await repo.mcp.getByName(ctx.workspaceId, draft.name)) { skipped.push({ name: draft.name, reason: "a server with this name already exists" }); continue; }
      const slugTaken = await ownerSlugTaken("mcp", ctx.workspaceId, draft.name);
      if (slugTaken) { skipped.push({ name: draft.name, reason: slugTaken }); continue; }
      const row = await repo.mcp.create({ workspaceId: ctx.workspaceId, name: draft.name, url: draft.url, transport: draft.transport, headers: draft.headers, enabled: true, scopeAll: scope.all, scopeIds: scope.ids, agentIds });
      created.push(mcpOut(row));
    }
    return { created, skipped };
  });

  // ==================================================== Connector templates ==
  app.get("/connector-templates", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    return listTemplates().map((t) => ({ id: t.id, name: t.name, description: t.description, icon: t.icon, fields: t.fields, commands: t.commands, broadcasts: t.broadcasts, ...(t.pollIntervalMs ? { pollIntervalMs: t.pollIntervalMs } : {}) }));
  });

  // ==================================================== Connector instances ==
  app.get("/instances", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { templateId } = req.query as { templateId?: string };
    let rows = await repo.instances.list(ctx.workspaceId);
    if (templateId) rows = rows.filter((r) => r.template_id === templateId);
    return rows.map((r) => instanceOut(repo, r));
  });

  app.post("/instances", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const b = req.body as { templateId?: string; name?: string; config?: Record<string, unknown>; enabled?: boolean; scope?: unknown; agentIds?: unknown; force?: boolean };
    const template = b.templateId ? getTemplate(b.templateId) : undefined;
    if (!template) return reply.code(400).send({ error: `unknown template "${b.templateId}"` });
    const name = (b.name ?? "").trim();
    if (!name) return reply.code(400).send({ error: "name is required" });
    if (await repo.instances.getByName(ctx.workspaceId, name)) return reply.code(409).send({ error: `an instance named "${name}" already exists` });
    const slugTaken = await ownerSlugTaken("connector", ctx.workspaceId, name);
    if (slugTaken) return reply.code(409).send({ error: slugTaken });

    const incoming: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.config ?? {})) incoming[k] = String(v ?? "");
    for (const field of template.fields) {
      const v = incoming[field.key];
      if (field.required !== false && !field.optional && !String(v ?? "").trim()) return reply.code(400).send({ error: `field "${field.label}" is required` });
    }
    const config: Record<string, string> = {};
    for (const field of template.fields) config[field.key] = incoming[field.key] ?? "";

    // health-check unless forced
    if (!b.force) {
      try {
        await template.healthCheck(config);
      } catch (err) {
        return reply.code(502).send({ error: `health check failed: ${(err as Error).message}` });
      }
    }
    const scope = parseScope(b.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    const agentIds = parseAgentIds(b.agentIds);
    if ("error" in agentIds) return reply.code(400).send({ error: agentIds.error });

    const row = await repo.instances.create({ workspaceId: ctx.workspaceId, template, name, config, enabled: b.enabled !== false, scopeAll: scope.all, scopeIds: scope.ids, agentIds });
    await repo.instances.setHealth(ctx.workspaceId, row.id, "ok", null);
    return reply.code(201).send(instanceOut(repo, row));
  });

  app.get("/instances/:id", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const row = await repo.instances.get(ctx.workspaceId, id);
    if (!row) return reply.code(404).send({ error: "not found" });
    const template = getTemplate(row.template_id)!;
    return { ...instanceOut(repo, row), template: { id: template.id, name: template.name, description: template.description, icon: template.icon, fields: template.fields, commands: template.commands, broadcasts: template.broadcasts, ...(template.pollIntervalMs ? { pollIntervalMs: template.pollIntervalMs } : {}) }, tools: toolsOf(row, template) };
  });

  app.patch("/instances/:id", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const row = await repo.instances.get(ctx.workspaceId, id);
    if (!row) return reply.code(404).send({ error: "not found" });
    const template = getTemplate(row.template_id)!;
    const b = req.body as { name?: string; config?: Record<string, unknown>; enabled?: boolean; scope?: unknown; agentIds?: unknown; force?: boolean };

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) return reply.code(400).send({ error: "name cannot be empty" });
      const taken = await repo.instances.getByName(ctx.workspaceId, name);
      if (taken && taken.id !== id) return reply.code(409).send({ error: `an instance named "${name}" already exists` });
      const slugTaken = await ownerSlugTaken("connector", ctx.workspaceId, name, id);
      if (slugTaken) return reply.code(409).send({ error: slugTaken });
      await repo.instances.update(ctx.workspaceId, id, { name });
    }

    if (b.config !== undefined) {
      const incoming: Record<string, string> = {};
      for (const [k, v] of Object.entries(b.config)) incoming[k] = String(v ?? "");
      const resolved = resolveConfig(template, row, incoming);
      if ("error" in resolved) return reply.code(400).send({ error: resolved.error });
      const recheck = b.force !== true;
      if (recheck) {
        try {
          await template.healthCheck(resolved.config);
        } catch (err) {
          return reply.code(502).send({ error: `health check failed: ${(err as Error).message}` });
        }
      }
      await repo.instances.updateConfig(ctx.workspaceId, id, template, resolved.config);
      await repo.instances.setHealth(ctx.workspaceId, id, "ok", null);
    }

    if (b.enabled !== undefined) await repo.instances.update(ctx.workspaceId, id, { enabled: b.enabled ? 1 : 0 });
    if (b.scope !== undefined) {
      const scope = parseScope(b.scope);
      if ("error" in scope) return reply.code(400).send({ error: scope.error });
      await repo.instances.update(ctx.workspaceId, id, { scope_mode: scope.all ? "all" : "spaces", scope_all: scope.all ? 1 : 0, scope_ids_json: JSON.stringify(scope.ids) });
    }
    if (b.agentIds !== undefined) {
      const agentIds = parseAgentIds(b.agentIds);
      if ("error" in agentIds) return reply.code(400).send({ error: agentIds.error });
      await repo.instances.update(ctx.workspaceId, id, { agent_ids_json: JSON.stringify(agentIds) });
    }

    const updated = await repo.instances.get(ctx.workspaceId, id);
    return updated ? instanceOut(repo, updated) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/instances/:id", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    if (!(await repo.instances.get(ctx.workspaceId, id))) return reply.code(404).send({ error: "not found" });
    await repo.instances.remove(ctx.workspaceId, id);
    return { ok: true };
  });

  app.post("/instances/:id/health", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const live = await repo.instances.getLive(ctx.workspaceId, id);
    if (!live) return reply.code(404).send({ error: "not found" });
    const template = getTemplate(live.row.template_id)!;
    try {
      await template.healthCheck(live.config);
      await repo.instances.setHealth(ctx.workspaceId, id, "ok", null);
    } catch (err) {
      await repo.instances.setHealth(ctx.workspaceId, id, "error", (err as Error).message);
    }
    const updated = await repo.instances.get(ctx.workspaceId, id);
    return instanceOut(repo, updated!);
  });

  app.post("/instances/:id/poll", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const live = await repo.instances.getLive(ctx.workspaceId, id);
    if (!live) return reply.code(404).send({ error: "not found" });
    const template = getTemplate(live.row.template_id)!;
    if (!template.poll) return reply.code(400).send({ error: "template has no poller" });
    const rt = makeRuntime(live.row, live.config);
    try {
      await template.poll(rt);
    } catch (err) {
      return reply.code(502).send({ error: `poll failed: ${(err as Error).message}` });
    }
    return { ok: true };
  });

  // ============================================================ Tools =======
  //
  // Two addressing modes:
  //  - ids: `<instanceId>.<command>` — used by the toolkit webapp
  //  - names: `<instance_name>_<command>` (slugified) — used by agents via
  //    Artisan's call_tool. Toolkit owns resolution + agent-access filtering.

  /** All connector tools of the workspace, each annotated with owner + access. */
  const allConnectorTools = async (workspaceId: string) => {
    const rows = (await repo.instances.list(workspaceId)).filter((r) => Number(r.enabled) === 1);
    const out: Array<ReturnType<typeof toolsOf>[number] & { agentIds: string[]; spaceAll: boolean; spaceIds: string[] }> = [];
    for (const row of rows) {
      const template = getTemplate(row.template_id);
      if (!template) continue;
      const agentIds = JSON.parse(row.agent_ids_json ?? "[]") as string[];
      for (const t of toolsOf(row, template)) {
        out.push({ ...t, agentIds, spaceAll: Number(row.scope_all) === 1, spaceIds: JSON.parse(row.scope_ids_json) as string[] });
      }
    }
    return out;
  };

  /** Resolve a NAME-addressed tool to its owning instance row + command. */
  const resolveByName = async (workspaceId: string, name: string) => {
    const rows = await repo.instances.list(workspaceId);
    for (const row of rows) {
      const template = getTemplate(row.template_id);
      if (!template) continue;
      const cmd = template.commands.find((c) => connectorToolName(row.name, c.name) === name);
      if (cmd) return { row, template, command: cmd };
    }
    return undefined;
  };

  app.get("/tools", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { templateId } = req.query as { templateId?: string };
    const agent = agentCtxOf(req);
    let tools = await allConnectorTools(ctx.workspaceId);
    if (templateId) tools = tools.filter((t) => t.templateId === templateId);
    // agent context (trusted app caller): filter by agent access + space scope.
    // No agent context (webapp user) sees everything.
    if (agent) {
      tools = tools.filter((t) => agentCanUse(t.agentIds, agent.agentId));
      if (agent.spaceIds.length > 0) tools = tools.filter((t) => t.spaceAll || t.spaceIds.some((id) => agent.spaceIds.includes(id)));
    }
    return tools.map(({ agentIds, spaceAll, spaceIds, ...t }) => t);
  });

  app.post("/tools/:toolId/invoke", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { toolId } = req.params as { toolId: string };
    const agent = agentCtxOf(req);

    let instanceRow: Selectable<ConnectorInstanceRow> | undefined;
    let command: string;

    if (TOOL_NAME_RE.test(toolId)) {
      // name-addressed (agents): toolkit resolves + enforces access
      const hit = await resolveByName(ctx.workspaceId, toolId);
      if (!hit) return reply.code(404).send({ error: `unknown tool "${toolId}"` });
      instanceRow = hit.row;
      command = hit.command.name;
      if (agent) {
        const agentIds = JSON.parse(instanceRow.agent_ids_json ?? "[]") as string[];
        if (!agentCanUse(agentIds, agent.agentId)) return reply.code(403).send({ error: `tool "${toolId}" is not available to this agent` });
        if (agent.spaceIds.length > 0) {
          const all = Number(instanceRow.scope_all) === 1;
          const ids = JSON.parse(instanceRow.scope_ids_json) as string[];
          if (!all && !ids.some((id) => agent.spaceIds.includes(id))) return reply.code(403).send({ error: `tool "${toolId}" is not available in this space` });
        }
      }
    } else {
      // id-addressed (webapp): <instanceId>.<command>
      const dot = toolId.lastIndexOf(".");
      if (dot <= 0) return reply.code(400).send({ error: "tool id must be <instanceId>.<command> or a snake_case tool name" });
      const instanceId = toolId.slice(0, dot);
      command = toolId.slice(dot + 1);
      instanceRow = await repo.instances.get(ctx.workspaceId, instanceId);
      if (!instanceRow) return reply.code(404).send({ error: `no instance ${instanceId}` });
    }

    if (Number(instanceRow.enabled) !== 1) return reply.code(409).send({ error: `connector "${instanceRow.name}" is disabled` });
    const template = getTemplate(instanceRow.template_id)!;
    const cmdSpec = template.commands.find((c) => c.name === command);
    if (!cmdSpec) return reply.code(404).send({ error: `unknown command "${command}"` });

    const params = ((req.body as { params?: Record<string, unknown> })?.params ?? {}) as Record<string, unknown>;
    // validate required params against the command spec (types coerced loosely)
    for (const [key, spec] of Object.entries(cmdSpec.params)) {
      const v = params[key];
      if (spec.required && (v === undefined || v === null || String(v).trim() === "")) {
        return reply.code(400).send({ error: `missing required parameter "${key}" (${spec.description})` });
      }
      if (v !== undefined && v !== null && spec.type === "number") {
        const n = Number(v);
        if (!Number.isFinite(n)) return reply.code(400).send({ error: `parameter "${key}" must be a number` });
        params[key] = n;
      }
    }

    const live = await repo.instances.getLive(ctx.workspaceId, instanceRow.id);
    if (!live) return reply.code(404).send({ error: "instance not found" });
    const rt = makeRuntime(live.row, live.config);
    try {
      const output = await template.execute(command, params, rt);
      return { output };
    } catch (err: any) {
      const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 502;
      return reply.code(status).send({ error: `command failed: ${err?.message ?? String(err)}` });
    }
  });

  // ==================================================== Agent catalog =======
  // Artisan owns agents; toolkit's UI needs them for the access picker. The
  // webapp reaches this through the gateway with its own session, and we
  // re-call artisan with the same identity (headers pass through).
  app.get("/agents", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    try {
      const res = await fetch(
        `${config.TWODB_GATEWAY_URL ?? process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400"}/apps/${ARTISAN_APP}/api/agents`,
        {
          headers: {
            ...(req.headers["x-twodb-auth-kind"] ? { "x-twodb-auth-kind": String(req.headers["x-twodb-auth-kind"]) } : {}),
            ...(req.headers.authorization ? { authorization: String(req.headers.authorization) } : {}),
            ...(req.headers.cookie ? { cookie: String(req.headers.cookie) } : {}),
            "x-twodb-workspace-id": ctx.workspaceId,
            ...(ctx.spaceIds.length ? { "x-twodb-space-ids": ctx.spaceIds.join(",") } : {}),
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) return reply.code(502).send({ error: `artisan answered ${res.status}` });
      const agents = (await res.json()) as Array<{ id: string; name: string; type: string; description?: string }>;
      return { agents: agents.map((a) => ({ id: a.id, name: a.name, type: a.type, description: a.description ?? null })) };
    } catch (err) {
      return reply.code(502).send({ error: `agent catalog unavailable: ${(err as Error).message}` });
    }
  });

  // ======================================================= Broadcasts =======
  app.get("/events", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const q = req.query as { instanceId?: string; event?: string; since?: string; limit?: string };
    const rows = await repo.broadcasts.list(ctx.workspaceId, { instanceId: q.instanceId, event: q.event, since: q.since, limit: q.limit ? Number(q.limit) : 50 });
    return { events: rows.map((r) => repo.broadcasts.norm(r)) };
  });

  app.get("/events/stream", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const q = req.query as { instanceId?: string; event?: string };
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    reply.raw.write(`retry: 5000\n\n`);
    const push: (msg: { event: string; payload: any }) => void = (msg) => {
      if (q.instanceId && msg.payload.instanceId !== q.instanceId) return;
      if (q.event && msg.event !== q.event) return;
      reply.raw.write(`data: ${JSON.stringify({ event: msg.event, ...msg.payload })}\n\n`);
    };
    sseSubscribers.add(push);
    const keepAlive = setInterval(() => reply.raw.write(`: ping\n\n`), 20_000);
    req.raw.on("close", () => {
      sseSubscribers.delete(push);
      clearInterval(keepAlive);
    });
    await new Promise(() => { /* held open until client disconnects */ });
  });

  // =========================================================== Queues =======
  app.get("/queues", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { instanceId } = req.query as { instanceId?: string };
    const rows = await repo.queues.list(ctx.workspaceId, instanceId);
    return { queues: rows.map((q) => ({ id: q.id, instanceId: q.instance_id, name: q.name, createdBy: q.created_by, createdAt: new Date(q.created_at).toISOString(), pending: q.pending })) };
  });

  app.post("/queues", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const b = req.body as { instanceId?: string; name?: string };
    const name = (b.name ?? "").trim();
    if (!/^[\w][\w-]*$/.test(name)) return reply.code(400).send({ error: "queue name must be letters, digits, _ or -" });
    if (!b.instanceId) return reply.code(400).send({ error: "instanceId is required" });
    if (!(await repo.instances.get(ctx.workspaceId, b.instanceId))) return reply.code(404).send({ error: "instance not found" });
    const q = await repo.queues.create(ctx.workspaceId, b.instanceId, name, ctx.userId);
    return reply.code(201).send({ id: q.id, instanceId: q.instance_id, name: q.name, createdBy: q.created_by, createdAt: new Date(q.created_at).toISOString(), pending: 0 });
  });

  const queueItemOut = (i: { id: string; queue_id: string; event: string; payload_json: string; status: string; created_at: string | Date; delivered_at: string | Date | null }) => ({
    id: i.id, queueId: i.queue_id, event: i.event, payload: JSON.parse(i.payload_json), status: i.status,
    createdAt: new Date(i.created_at).toISOString(), deliveredAt: i.delivered_at ? new Date(i.delivered_at).toISOString() : null,
  });

  app.delete("/queues/:instanceId/:name", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { instanceId, name } = req.params as { instanceId: string; name: string };
    if (!(await repo.queues.get(ctx.workspaceId, instanceId, name))) return reply.code(404).send({ error: "not found" });
    await repo.queues.remove(ctx.workspaceId, instanceId, name);
    return { ok: true };
  });

  app.post("/queues/:instanceId/:name/next", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { instanceId, name } = req.params as { instanceId: string; name: string };
    const q = await repo.queues.get(ctx.workspaceId, instanceId, name);
    if (!q) return reply.code(404).send({ error: "not found" });
    const item = await repo.queues.next(q.id);
    return { item: item ? queueItemOut(item) : null };
  });

  app.get("/queues/:instanceId/:name/peek", async (req, reply) => {
    const ctx = auth(req, reply); if (!ctx) return reply;
    const { instanceId, name } = req.params as { instanceId: string; name: string };
    const q = await repo.queues.get(ctx.workspaceId, instanceId, name);
    if (!q) return reply.code(404).send({ error: "not found" });
    const { limit } = req.query as { limit?: string };
    const items = await repo.queues.peek(q.id, Math.min(Number(limit ?? 20) || 20, 100));
    return { items: items.map(queueItemOut) };
  });

  // ============================================================ boot ========
  const poller = startPoller({ db, repo, publish: publishBroadcast, log: (m, d) => app.log.info(d ?? {}, m) });

  const close = async () => {
    poller.stop();
    await asyncEngine.close();
  };
  app.addHook("onClose", async () => { await close(); });

  // ============================================================ TwoDB tools =
  //
  // The whole TwoDB API surface (every installed app's endpoints — what `twodb <app> <command>` reaches) as agent
  // tools, derived live from the control plane's catalog. Fixed: no instances, nothing to configure per tool. Access is
  // a per-scope allow-list (a space or an agent, default none); a call is allowed when the agent's list OR the call's
  // space list has the tool. Calls run machine-to-machine (toolkit acts in the workspace through the gateway, with the
  // call's space attached) — the caller's own credentials are never needed.

  let twodbCatalog: { at: number; tools: TwoDbTool[] } | null = null;
  const loadTwodbTools = async (): Promise<TwoDbTool[]> => {
    if (twodbCatalog && Date.now() - twodbCatalog.at < 60_000) return twodbCatalog.tools;
    if (!platform) throw Object.assign(new Error("toolkit is not connected to the control plane"), { status: 503 });
    const res = await platform.gatewayFetch("/registry/catalog");
    if (!res.ok) throw Object.assign(new Error(`app catalog unavailable (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`), { status: 502 });
    const tools = deriveTools((await res.json()) as CatalogApp[]);
    twodbCatalog = { at: Date.now(), tools };
    return tools;
  };

  const spaceIdsOf = (req: FastifyRequest, agent: { spaceIds: string[] }): string[] => {
    const q = ((req.query as Record<string, string | undefined> | undefined)?.spaceId ?? "").trim();
    return [...new Set([...agent.spaceIds, ...(q ? [q] : [])])];
  };

  /** Agent-facing guard: needs an agent context (trusted caller), loads the catalog and narrows it to what is enabled for the agent or the space. */
  const twodbForAgent = async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = auth(req, reply); if (!ctx) return null;
    const agent = agentCtxOf(req);
    if (!agent) { void reply.code(403).send({ error: "TwoDB tools are only available to agents" }); return null; }
    const spaceIds = spaceIdsOf(req, agent);
    try {
      const all = await loadTwodbTools();
      const agentTools = await repo.twodbAccess.get(ctx.workspaceId, "agent", agent.agentId);
      const spaceTools = await Promise.all(spaceIds.map((id) => repo.twodbAccess.get(ctx.workspaceId, "space", id)));
      return { ctx, spaceIds, tools: all.filter((t) => isAllowed(t.key, agentTools, spaceTools)) };
    } catch (err: any) {
      void reply.code(err?.status ?? 502).send({ error: err?.message ?? String(err) });
      return null;
    }
  };

  app.get("/twodb/apps", async (req, reply) => {
    const g = await twodbForAgent(req, reply); if (!g) return reply;
    const byApp = new Map<string, { slug: string; name: string; tools: number }>();
    for (const t of g.tools) {
      const e = byApp.get(t.app) ?? { slug: t.app, name: t.appName, tools: 0 };
      e.tools += 1;
      byApp.set(t.app, e);
    }
    return [...byApp.values()];
  });

  app.get("/twodb/apps/:app/tools", async (req, reply) => {
    const g = await twodbForAgent(req, reply); if (!g) return reply;
    const { app: slug } = req.params as { app: string };
    return g.tools.filter((t) => t.app === slug).map((t) => ({ name: t.name, method: t.method, description: t.description }));
  });

  app.get("/twodb/apps/:app/tools/:tool", async (req, reply) => {
    const g = await twodbForAgent(req, reply); if (!g) return reply;
    const { app: slug, tool } = req.params as { app: string; tool: string };
    const t = g.tools.find((x) => x.app === slug && x.name === tool);
    if (!t) return reply.code(404).send({ error: `"${slug}/${tool}" is not available to you — call get_app_tools` });
    return t;
  });

  app.post("/twodb/apps/:app/tools/:tool/invoke", async (req, reply) => {
    const g = await twodbForAgent(req, reply); if (!g) return reply;
    const { app: slug, tool } = req.params as { app: string; tool: string };
    // Not enabled and not existing look the same: nothing is revealed about tools you cannot use.
    const t = g.tools.find((x) => x.app === slug && x.name === tool);
    if (!t) return reply.code(403).send({ error: `"${slug}/${tool}" is not available to you — call get_app_tools` });
    const built = buildCall(t, ((req.body as { params?: Record<string, unknown> })?.params ?? {}));
    if ("error" in built) return reply.code(400).send({ error: built.error });
    const qs = new URLSearchParams(built.query).toString();
    try {
      const res = await platform!.serviceFetch(slug, g.ctx.workspaceId, `${built.path}${qs ? `?${qs}` : ""}`, {
        method: built.method,
        scopes: ["gateway.act"],
        headers: { ...(built.body ? { "content-type": "application/json" } : {}), ...(g.spaceIds.length ? { "x-twodb-space-ids": g.spaceIds.join(",") } : {}) },
        ...(built.body ? { body: JSON.stringify(built.body) } : {}),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      let output: unknown = text;
      try { output = text ? JSON.parse(text) : null; } catch { /* plain text */ }
      if (!res.ok) {
        const detail = typeof output === "object" && output && "error" in output ? String((output as { error: unknown }).error) : text.slice(0, 300);
        return reply.code(res.status >= 400 && res.status < 600 ? res.status : 502).send({ error: `${slug}/${tool} answered ${res.status}${detail ? `: ${detail}` : ""}` });
      }
      return { output };
    } catch (err: any) {
      return reply.code(502).send({ error: `${slug}/${tool} failed: ${err?.message ?? String(err)}` });
    }
  });

  // --- configuration (the toolkit webapp; never reachable with an agent context) -----------------------
  const twodbConfigAuth = (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = auth(req, reply); if (!ctx) return null;
    if (agentCtxOf(req)) { void reply.code(403).send({ error: "agents cannot read or change TwoDB tool access" }); return null; }
    return ctx;
  };

  app.get("/twodb/tools", async (req, reply) => {
    if (!twodbConfigAuth(req, reply)) return reply;
    try { return await loadTwodbTools(); } catch (err: any) { return reply.code(err?.status ?? 502).send({ error: err?.message ?? String(err) }); }
  });

  /** Scopes that have anything enabled, with counts — drives the page's scope list badges. */
  app.get("/twodb/access", async (req, reply) => {
    const ctx = twodbConfigAuth(req, reply); if (!ctx) return reply;
    return (await repo.twodbAccess.list(ctx.workspaceId)).map((r) => ({ scopeType: r.scopeType, scopeId: r.scopeId, count: r.tools.length }));
  });

  app.get("/twodb/access/:scopeType/:scopeId", async (req, reply) => {
    const ctx = twodbConfigAuth(req, reply); if (!ctx) return reply;
    const { scopeType, scopeId } = req.params as { scopeType: string; scopeId: string };
    if (scopeType !== "space" && scopeType !== "agent") return reply.code(400).send({ error: "scopeType must be space or agent" });
    return { scopeType, scopeId, tools: await repo.twodbAccess.get(ctx.workspaceId, scopeType, scopeId) };
  });

  app.put("/twodb/access/:scopeType/:scopeId", async (req, reply) => {
    const ctx = twodbConfigAuth(req, reply); if (!ctx) return reply;
    const { scopeType, scopeId } = req.params as { scopeType: string; scopeId: string };
    if (scopeType !== "space" && scopeType !== "agent") return reply.code(400).send({ error: "scopeType must be space or agent" });
    const raw = (req.body as { tools?: unknown })?.tools;
    if (!Array.isArray(raw)) return reply.code(400).send({ error: "tools must be an array of `<app>/<tool>` keys" });
    const keys = [...new Set(raw.map(String))];
    try {
      const known = new Set((await loadTwodbTools()).map((t) => t.key));
      const unknown = keys.filter((k) => !known.has(k));
      if (unknown.length) return reply.code(400).send({ error: `unknown tools: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}` });
    } catch (err: any) { return reply.code(err?.status ?? 502).send({ error: err?.message ?? String(err) }); }
    await repo.twodbAccess.set(ctx.workspaceId, scopeType, scopeId, keys);
    return { scopeType, scopeId, tools: keys };
  });

  await registerWebapp(app, { distDir: webappDist(import.meta.dirname) });
  return app;
}
