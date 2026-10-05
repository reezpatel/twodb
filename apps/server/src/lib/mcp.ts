import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Selectable } from "kysely";
import { db } from "../auth";
import type { McpServerTable } from "../plugins/db";
import type { AgentTool } from "./agent";
import { DEFAULT_SKILL_TAG } from "./skills";

// MCP server registry: rows from `mcp_server` (Settings → LLM → MCP) become
// agent tools in code sessions. HTTP/sse transports only — the server process
// connects out; no local stdio servers (those belong on a runner, not here).

export const MCP_TOOL_PREFIX = "mcp__";
const CONNECT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 120_000;
/** Tool name half of mcp__<server>__<tool> must stay bounded for LLM tool names. */
const MAX_TOOL_NAME = 64;

/** Environment placeholders in header values — <FIRECRAWL_API_KEY> → env.FIRECRAWL_API_KEY. */
const ENV_RE = /<([A-Z0-9_]+)>/g;

function resolveSecrets(value: string): string {
  return value.replace(ENV_RE, (_, name) => process.env[name] ?? "");
}

export function mcpToolName(server: string, tool: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, MAX_TOOL_NAME);
  return `${MCP_TOOL_PREFIX}${safe(server)}__${safe(tool)}`;
}

interface PooledClient {
  client: Client;
  connectedAt: number;
}

const pool = new Map<string, PooledClient>();

function transportFor(row: Selectable<McpServerTable>, url: URL) {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.headers ?? {})) headers[key] = resolveSecrets(String(value));
  const requestInit = { headers };
  // Both transports read custom headers off requestInit; connect() takes no
  // options — timeouts ride on the individual listTools/callTool requests.
  if (row.transport === "sse") return new SSEClientTransport(url, { requestInit });
  return new StreamableHTTPClientTransport(url, { requestInit });
}

async function connect(row: Selectable<McpServerTable>): Promise<Client> {
  const client = new Client({ name: "twodb", version: "1.0.0" });
  const url = new URL(row.url);
  if (row.transport === "sse") {
    await client.connect(transportFor(row, url));
    pool.set(row.id, { client, connectedAt: Date.now() });
    return client;
  }
  try {
    await client.connect(transportFor(row, url));
  } catch {
    // auto + sse: fall back to the legacy SSE endpoint of servers without streamable http.
    if (row.transport === "http") throw new Error("streamable http transport failed");
    const sse = new Client({ name: "twodb", version: "1.0.0" });
    await sse.connect(transportFor({ ...row, transport: "sse" } as Selectable<McpServerTable>, url));
    await client.close().catch(() => {});
    pool.set(row.id, { client: sse, connectedAt: Date.now() });
    return sse;
  }
  pool.set(row.id, { client, connectedAt: Date.now() });
  return client;
}

/** Drop a pooled connection (config change, delete, or repeated failure). */
export function evictMcpClient(serverId: string) {
  const pooled = pool.get(serverId);
  pool.delete(serverId);
  if (pooled) void pooled.client.close().catch(() => {});
}

async function clientFor(row: Selectable<McpServerTable>): Promise<Client> {
  const pooled = pool.get(row.id);
  if (pooled) return pooled.client;
  return connect(row);
}

export interface McpTool {
  tool: AgentTool;
  serverId: string;
  serverName: string;
  remoteName: string;
}

/** Live tools of one server — connected on demand, cached until evicted. */
export async function listMcpServerTools(row: Selectable<McpServerTable>): Promise<McpTool[]> {
  const client = await clientFor(row);
  const { tools } = await client.listTools(undefined, { timeout: CONNECT_TIMEOUT_MS } as never).catch((e) => {
    evictMcpClient(row.id);
    throw e;
  });
  return tools.map((t) => ({
    serverId: row.id,
    serverName: row.name,
    remoteName: t.name,
    tool: {
      name: mcpToolName(row.name, t.name),
      description: t.description ? `${t.description} (MCP server: ${row.name})` : `Tool "${t.name}" from MCP server ${row.name}`,
      parameters: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
      scope: ["code"] as const,
    },
  }));
}

/** True when the server's scope covers the session and its tags match. */
export function mcpServerMatches(row: Selectable<McpServerTable>, codeDirectoryId: string | null, sessionTags: string[]): boolean {
  if (!row.enabled) return false;
  if (row.codeDirectoryId && row.codeDirectoryId !== codeDirectoryId) return false;
  if (row.tags.includes(DEFAULT_SKILL_TAG)) return true;
  return row.tags.some((t) => sessionTags.includes(t));
}

/** Matching servers for a session — org-wide or directory-scoped. */
export async function listSessionMcpServers(organizationId: string, codeDirectoryId: string | null, sessionTags: string[]): Promise<Selectable<McpServerTable>[]> {
  const rows = await db
    .selectFrom("mcp_server")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where((eb) => eb.or([eb("codeDirectoryId", "is", null), ...(codeDirectoryId ? [eb("codeDirectoryId", "=", codeDirectoryId)] : [])]))
    .execute();
  return rows.filter((r) => mcpServerMatches(r, codeDirectoryId, sessionTags));
}

/** Tool list for a session; unreachable servers are skipped with their error attached. */
export async function loadSessionMcpTools(
  organizationId: string,
  codeDirectoryId: string | null,
  sessionTags: string[],
): Promise<{ tools: McpTool[]; failures: { server: string; error: string }[] }> {
  const rows = await listSessionMcpServers(organizationId, codeDirectoryId, sessionTags);
  const settled = await Promise.allSettled(rows.map((row) => listMcpServerTools(row)));
  const tools: McpTool[] = [];
  const failures: { server: string; error: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") tools.push(...r.value);
    else failures.push({ server: rows[i].name, error: (r.reason as Error).message });
  });
  return { tools, failures };
}

/** Execute one namespaced MCP tool call. Unknown/unreachable → thrown, caught by the loop. */
export async function callMcpTool(organizationId: string, name: string, args: Record<string, unknown>): Promise<string> {
  // mcp__<server>__<tool> — find the server whose safe-mapped name prefixes the
  // call; exact tool match disambiguates (names may contain __ after mapping).
  const rest = name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : "";
  const safeName = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, MAX_TOOL_NAME);
  const rows = await db.selectFrom("mcp_server").selectAll().where("organizationId", "=", organizationId).execute();
  const candidates = rows.filter((r) => rest.startsWith(`${safeName(r.name)}__`));
  if (candidates.length === 0) throw new Error(`unknown MCP tool "${name}"`);

  for (const row of candidates) {
    const client = await clientFor(row);
    const { tools } = await client
      .listTools(undefined, { timeout: CONNECT_TIMEOUT_MS } as never)
      .catch((e) => {
        evictMcpClient(row.id);
        throw e;
      });
    const remote = tools.find((t) => mcpToolName(row.name, t.name) === name);
    if (!remote) continue;

    const result = await client
      .callTool({ name: remote.name, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS } as never)
      .catch((e) => {
        evictMcpClient(row.id);
        throw e;
      });
    if (result.isError) {
      const text = contentToText(result.content);
      throw new Error(text || `MCP server ${row.name} reported an error`);
    }
    return contentToText(result.content);
  }
  throw new Error(`MCP server no longer offers "${name}"`);
}

/** Flattens tool result content blocks into one string for the transcript. */
function contentToText(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === "string" ? content : content ? JSON.stringify(content) : "";
  const parts: string[] = [];
  for (const block of content as Record<string, unknown>[]) {
    if (block?.type === "text" && typeof block.text === "string") parts.push(block.text);
    else if (block?.type === "resource" && block.resource && typeof block.resource === "object") {
      const res = block.resource as { uri?: string; text?: string; blob?: string };
      parts.push(res.text ?? `[resource: ${res.uri ?? "unknown"}]`);
    } else if (block?.type === "image" || block?.type === "audio") {
      parts.push(`[${block.type} content omitted]`);
    } else parts.push(JSON.stringify(block));
  }
  return parts.join("\n").slice(0, 8000);
}

// --- mcpServers JSON import (VS Code / Claude Desktop / Cursor format) ------

export interface McpImportDraft {
  name: string;
  url: string;
  transport: string;
  headers: Record<string, string>;
}

interface ParsedEntry {
  type?: unknown;
  url?: unknown;
  headers?: unknown;
}

/**
 * Parses the standard `{ "mcpServers": { <name>: { type: "http"|"sse", url, headers } } }`
 * format. stdio entries (command/args) are skipped — only remote servers apply.
 * Returns per-entry errors so the UI can explain what was left out.
 */
export function parseMcpServersJson(input: unknown): { drafts: McpImportDraft[]; skipped: { name: string; reason: string }[] } | { error: string } {
  let root: Record<string, unknown>;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { error: "not valid JSON" };
    }
  }
  const record = input as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || Array.isArray(record)) return { error: "expected a JSON object" };
  const servers = record.mcpServers && typeof record.mcpServers === "object" && !Array.isArray(record.mcpServers) ? record.mcpServers : null;
  root = (servers ?? record) as Record<string, unknown>;

  const drafts: McpImportDraft[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const [name, raw] of Object.entries(root)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      skipped.push({ name, reason: "entry is not an object" });
      continue;
    }
    const entry = raw as ParsedEntry;
    if (typeof entry.url !== "string" || !entry.url.trim()) {
      skipped.push({ name, reason: entry.type === "stdio" || "command" in (entry as object) ? "stdio servers are not supported — use an http/sse URL" : "missing url" });
      continue;
    }
    let url: URL;
    try {
      url = new URL(entry.url.trim());
    } catch {
      skipped.push({ name, reason: `invalid url "${entry.url}"` });
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      skipped.push({ name, reason: `unsupported protocol ${url.protocol}` });
      continue;
    }
    const headers: Record<string, string> = {};
    if (entry.headers && typeof entry.headers === "object" && !Array.isArray(entry.headers)) {
      for (const [k, v] of Object.entries(entry.headers as Record<string, unknown>)) if (typeof v === "string") headers[k] = v;
    }
    drafts.push({ name, url: url.toString(), transport: entry.type === "sse" ? "sse" : "auto", headers });
  }
  return { drafts, skipped };
}
