/**
 * Unified tool naming: every MCP server and connector instance exposes tools
 * named `<owner>_<tool>` where <owner> is the instance/server name
 * slugified (`navera-engineering` → `navera_engineering`). Uniqueness is
 * enforced within a workspace per kind at create/rename time (see
 * server.ts assertUniqueOwner); collisions get a numeric suffix.
 *
 * Toolkit owns resolution: `resolveTool(workspaceId, name, { agentId, spaceIds })`
 * → the owning instance/server + its access check, so callers (Artisan)
 * never see ids — names only.
 */

export function slugifyOwner(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "tool";
}

export const TOOL_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** `<owner>_<tool>` for connector commands (tool = command name). */
export function connectorToolName(instanceName: string, command: string): string {
  return `${slugifyOwner(instanceName)}_${command}`;
}

/** MCP tools carry the `mcp__<server>__<tool>` prefix inside the name. */
export function mcpToolName(serverName: string, tool: string): string {
  return `mcp__${slugifyOwner(serverName)}__${tool}`;
}

/** Owns-tools check: agentIds empty = all agents, else the listed ids only. */
export function agentCanUse(agentIds: string[], agentId: string | null | undefined): boolean {
  if (!agentId) return false; // anonymous callers see nothing
  return agentIds.length === 0 || agentIds.includes(agentId);
}
