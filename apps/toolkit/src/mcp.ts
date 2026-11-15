/**
 * External MCP server configuration. Config only for now — servers are stored
 * and scoped; listing/proxy tool calls come later. Ported from Artisan's
 * mcp.ts (which keeps its own copy until it migrates here), simplified to the
 * toolkit's space-scoped model (all | specific spaces).
 */
export const MCP_TRANSPORTS = ["auto", "http", "sse"] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

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

/** Headers: a flat string→string object. */
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

export interface McpScope {
  all: boolean;
  ids: string[];
}

export function validateScope(scope: McpScope): string | null {
  if (!scope.all && scope.ids.length === 0) return `pick at least one space or choose "all spaces"`;
  return null;
}

export interface McpImportDraft { name: string; url: string; transport: McpTransport; headers: Record<string, string> }

/**
 * Parses the standard `{ "mcpServers": { <name>: { type: "http"|"sse", url, headers } } }`
 * format (VS Code / Claude Desktop / Cursor). stdio entries are skipped —
 * only remote servers apply.
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
      for (const [k, v] of Object.entries(e.headers as Record<string, unknown>)) {
        if (typeof v !== "string") { skipped.push({ name, reason: "header values must be strings" }); continue; }
        headers[k.trim()] = v;
      }
    }
    const transport: McpTransport = e.type === "sse" ? "sse" : e.type === "http" || e.type === "streamable-http" || e.type === "streamableHttp" ? "http" : "auto";
    drafts.push({ name, url, transport, headers });
  }
  return { drafts, skipped };
}
