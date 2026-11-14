import type { AgentRow, McpServerRow, SessionRow } from "./db/schema.js";

/**
 * MCP server configuration. Config only for now — servers are stored and scoped
 * but not yet connected or injected into agents. Availability mirrors skills,
 * plus a "directories" mode (the legacy per-directory pin).
 */
export type McpMode = "global" | "agents" | "spaces" | "directories" | "types";
export const MCP_MODES: McpMode[] = ["global", "agents", "spaces", "directories", "types"];
export const MCP_TRANSPORTS = ["auto", "http", "sse"] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

export interface McpScope {
  mode: McpMode;
  all: boolean;
  ids: string[];
}

export function mcpScopeOf(r: Pick<McpServerRow, "scope_mode" | "scope_all" | "scope_ids_json">): McpScope {
  const mode = (MCP_MODES as string[]).includes(r.scope_mode) ? (r.scope_mode as McpMode) : "global";
  let ids: string[] = [];
  try { ids = JSON.parse(r.scope_ids_json) as string[]; } catch { /* keep [] */ }
  return { mode, all: mode === "global" || Number(r.scope_all) === 1, ids };
}

const NOUN: Record<McpMode, string> = { global: "", agents: "agent", spaces: "space", directories: "directory", types: "agent type" };

export function validateMcpScope(scope: McpScope): string | null {
  if (!MCP_MODES.includes(scope.mode)) return `unknown availability mode "${scope.mode}"`;
  if (scope.mode !== "global" && !scope.all && scope.ids.length === 0) return `pick at least one ${NOUN[scope.mode]} or choose "all"`;
  return null;
}

/** Would this server be offered to this agent in this session? (Used once MCP is wired into agents.) */
export function mcpApplies(row: McpServerRow, agent: AgentRow, session: Pick<SessionRow, "space_id" | "directory_id">): boolean {
  if (!Number(row.enabled)) return false;
  const scope = mcpScopeOf(row);
  if (scope.all) return true;
  switch (scope.mode) {
    case "agents": return scope.ids.includes(agent.id);
    case "spaces": return scope.ids.includes(session.space_id);
    case "directories": return !!session.directory_id && scope.ids.includes(session.directory_id);
    case "types": return scope.ids.includes(agent.type);
    default: return true;
  }
}

export const NAME_RE = /^[\w][\w-]*$/;

export function validUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Headers: a flat string→string object. Values may carry <ENV_NAME> placeholders. */
export function parseHeaders(value: unknown): Record<string, string> | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "invalid";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string" || !k.trim()) return "invalid";
    out[k.trim()] = v;
  }
  return out;
}

export interface McpImportDraft { name: string; url: string; transport: McpTransport; headers: Record<string, string> }

/**
 * Parses the standard `{ "mcpServers": { <name>: { type: "http"|"sse", url, headers } } }` format
 * (VS Code / Claude Desktop / Cursor). stdio entries are skipped — only remote servers apply.
 */
export function parseMcpServersJson(input: unknown): { drafts: McpImportDraft[]; skipped: Array<{ name: string; reason: string }> } | { error: string } {
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch { return { error: "not valid JSON" }; }
  }
  const record = input as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || Array.isArray(record)) return { error: "expected a JSON object" };
  const nested = record.mcpServers && typeof record.mcpServers === "object" && !Array.isArray(record.mcpServers) ? record.mcpServers : null;
  const root = (nested ?? record) as Record<string, unknown>;

  const drafts: McpImportDraft[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  for (const [name, raw] of Object.entries(root)) {
    if (!NAME_RE.test(name)) { skipped.push({ name, reason: "name must be letters, digits, _ or -" }); continue; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { skipped.push({ name, reason: "entry is not an object" }); continue; }
    const e = raw as { type?: unknown; url?: unknown; headers?: unknown; command?: unknown };
    if (typeof e.url !== "string" || !e.url.trim()) {
      skipped.push({ name, reason: e.type === "stdio" || e.command !== undefined ? "stdio servers are not supported — use an http/sse URL" : "missing url" });
      continue;
    }
    const url = validUrl(e.url);
    if (!url) { skipped.push({ name, reason: `invalid url "${e.url}"` }); continue; }
    const headers: Record<string, string> = {};
    if (e.headers && typeof e.headers === "object" && !Array.isArray(e.headers)) {
      for (const [k, v] of Object.entries(e.headers as Record<string, unknown>)) if (typeof v === "string") headers[k] = v;
    }
    const transport: McpTransport = e.type === "sse" ? "sse" : e.type === "http" || e.type === "streamable-http" || e.type === "streamableHttp" ? "http" : "auto";
    drafts.push({ name, url, transport, headers });
  }
  if (drafts.length === 0 && skipped.length === 0) return { error: "no servers found" };
  return { drafts, skipped };
}
