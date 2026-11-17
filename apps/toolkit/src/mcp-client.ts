import type { McpServerRow } from "./db/schema.js";

/** Structural shape the client needs — the full McpServerRow satisfies this. */
export type McpServerRowLike = Pick<McpServerRow, "id" | "name" | "url" | "transport" | "headers_json" | "enabled"> & Partial<McpServerRow>;

import { mcpToolName } from "./tool-names.js";

/**
 * Minimal MCP client — speaks streamable-HTTP to a remote
 * MCP server: `initialize` → `tools/list` → `tools/call`. No SDK: the wire is
 * JSON-RPC 2.0 over HTTP POST (SSE-framed or plain JSON responses).
 *
 * Servers are configured in Toolkit → MCP (name, url, transport, headers).
 * Header values may carry `<ENV_NAME>` placeholders, resolved from toolkit's
 * environment at call time — so secrets never sit in the DB.
 *
 * Discovered tools are cached per server for TOOLS_TTL_MS so an agent turn
 * (which may list/describe/call several times) does not re-handshake every
 * call. Failures drop the cache entry so the next call retries fresh.
 */

const TOOLS_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const PROTOCOL_VERSION = "2025-03-26";
const CLIENT = { name: "twodb-toolkit", version: "1.0.0" };

/** MCP tool shape from tools/list (JSON-schema input). */
interface McpToolSpec {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** The params shape Artisan/Toolkit render (mirrors ConnectorCommand.params). */
export interface ToolParam {
  type: "string" | "number" | "boolean" | "enum" | "date";
  description: string;
  required?: boolean;
  options?: string[];
}

/** A discovered MCP tool, ready to merge into toolkit's /api/tools list. */
export interface McpListedTool {
  /** agent-facing name: mcp__<server>__<tool> */
  name: string;
  description: string;
  params: Record<string, ToolParam>;
}

/** Substitute `<ENV_NAME>` placeholders from the process environment. */
function resolveEnv(value: string): string {
  return value.replace(/<([A-Z_][A-Z0-9_]*)>/g, (m, name: string) => process.env[name] ?? m);
}

function headersOf(row: McpServerRowLike): Record<string, string> {
  const raw = JSON.parse(row.headers_json || "{}") as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = resolveEnv(v);
  return out;
}

/** Convert a JSON-schema property into our flat ToolParam. */
function paramOf(prop: Record<string, unknown>, required: boolean): ToolParam {
  const type = prop.type;
  const enm = Array.isArray(prop.enum) ? (prop.enum as unknown[]).map(String) : undefined;
  let t: ToolParam["type"] = "string";
  if (enm?.length) t = "enum";
  else if (type === "number" || type === "integer") t = "number";
  else if (type === "boolean") t = "boolean";
  else if (type === "string" && prop.format === "date") t = "date";
  return {
    type: t,
    description: typeof prop.description === "string" ? prop.description : "",
    ...(required ? { required: true } : {}),
    ...(enm?.length ? { options: enm } : {}),
  };
}

/** Flatten an MCP inputSchema into our params map (top-level properties only). */
function paramsOf(schema: Record<string, unknown> | undefined): Record<string, ToolParam> {
  const out: Record<string, ToolParam> = {};
  if (!schema || typeof schema !== "object") return out;
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as unknown[]).map(String) : []);
  for (const [key, prop] of Object.entries(props)) {
    if (prop && typeof prop === "object") out[key] = paramOf(prop, required.has(key));
  }
  return out;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string };
}

/**
 * One MCP server connection. Streamable-HTTP servers respond to a POST with
 * either `application/json` or `text/event-stream`; we handle both. (Legacy
 * GET-/sse handshake servers are not yet supported — Linear/n8n and most
 * current servers use streamable-HTTP.)
 */
class McpConnection {
  private id = 0;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(private readonly row: McpServerRowLike) {}

  private get baseHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headersOf(this.row),
      ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
    };
  }

  /** Parse a possibly-SSE body into the first JSON-RPC message. */
  private async readMessage(res: Response): Promise<JsonRpcResponse> {
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (ct.includes("text/event-stream")) {
      // collect `data:` lines; each is a JSON-RPC message
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t.startsWith("data:")) {
          const payload = t.slice(5).trim();
          if (!payload) continue;
          try { return JSON.parse(payload) as JsonRpcResponse; } catch { /* keep scanning */ }
        }
      }
      throw new Error("mcp: SSE response carried no JSON-RPC message");
    }
    return JSON.parse(text) as JsonRpcResponse;
  }

  /** Send one JSON-RPC request over streamable-HTTP and await its response. */
  private async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.id;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) });
    const res = await fetch(this.row.url, {
      method: "POST",
      headers: this.baseHeaders,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // capture the session id the server assigns on initialize
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`mcp ${method} failed: HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    if (res.status === 202) return undefined; // notification accepted, no body
    const msg = await this.readMessage(res);
    if (msg.error) throw new Error(`mcp ${method}: ${msg.error.message ?? `code ${msg.error.code}`}`);
    return msg.result;
  }

  private async notify(method: string): Promise<void> {
    const body = JSON.stringify({ jsonrpc: "2.0", method });
    await fetch(this.row.url, {
      method: "POST",
      headers: this.baseHeaders,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch(() => undefined);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT,
    });
    await this.notify("notifications/initialized");
    this.initialized = true;
  }

  async listTools(): Promise<McpToolSpec[]> {
    await this.initialize();
    const result = (await this.request("tools/list")) as { tools?: McpToolSpec[] } | undefined;
    return result?.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.initialize();
    const result = (await this.request("tools/call", { name, arguments: args })) as
      | { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
      | undefined;
    // MCP returns { content: [{type:"text", text}, ...], isError? } — unwrap to text/json.
    if (!result) return null;
    if (Array.isArray(result.content)) {
      const texts = result.content.filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text as string);
      const joined = texts.join("\n");
      if (result.isError) throw new Error(joined || "mcp tool reported an error");
      // Try to return structured JSON when the payload is JSON.
      try { return JSON.parse(joined); } catch { return joined; }
    }
    return result;
  }
}

/** Per-server connection + tools cache. */
interface CacheEntry {
  conn: McpConnection;
  tools: McpListedTool[];
  at: number;
}
const cache = new Map<string, CacheEntry>();

function connectionFor(row: McpServerRowLike): McpConnection {
  const hit = cache.get(row.id);
  if (hit) return hit.conn;
  const conn = new McpConnection(row);
  return conn;
}

function toListed(row: McpServerRowLike, spec: McpToolSpec): McpListedTool {
  return {
    name: mcpToolName(row.name, spec.name),
    description: spec.description ?? "",
    params: paramsOf(spec.inputSchema),
  };
}

/** Discover a server's tools, cached for TOOLS_TTL_MS. Throws on failure. */
export async function listMcpTools(row: McpServerRowLike): Promise<McpListedTool[]> {
  const hit = cache.get(row.id);
  if (hit && Date.now() - hit.at < TOOLS_TTL_MS) return hit.tools;
  const conn = new McpConnection(row); // fresh connection per discovery to avoid stale sessions
  const specs = await conn.listTools();
  const tools = specs.map((s) => toListed(row, s));
  cache.set(row.id, { conn, tools, at: Date.now() });
  return tools;
}

/** Best-effort tools list — servers that are down/unreachable just yield none. */
export async function listMcpToolsSafe(row: McpServerRowLike): Promise<McpListedTool[]> {
  try {
    return await listMcpTools(row);
  } catch {
    return [];
  }
}

/** Call one tool on a server by its agent-facing name. Throws on failure. */
export async function callMcpTool(row: McpServerRowLike, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const conn = connectionFor(row);
  try {
    const out = await conn.callTool(toolName, args);
    return out;
  } catch (err) {
    // drop any cached connection so the next call reconnects cleanly
    cache.delete(row.id);
    throw err;
  }
}

/** Resolve an agent-facing `mcp__<server>__<tool>` name to (serverRow?, toolName?). */
export function parseMcpToolName(name: string): { serverSlug: string; tool: string } | null {
  const m = /^mcp__([a-z0-9_]+)__(.+)$/.exec(name);
  if (!m) return null;
  return { serverSlug: m[1], tool: m[2] };
}

/** Drop a server's cached connection/tools (e.g. after config edits). */
export function invalidateMcp(rowId: string): void {
  cache.delete(rowId);
}

