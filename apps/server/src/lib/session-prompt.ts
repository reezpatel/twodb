import { db } from "../auth";
import { getCodeSettings } from "./code-settings";
import { DEFAULT_SKILL_TAG, enabledRepoSources, formatSkillsForPrompt, listRepoSkills, listSessionDbSkills, type SessionSkill } from "./skills";
import { formatMcpForPrompt, loadSessionMcpTools, type McpTool } from "./mcp";
import { ASSISTANT_DEFAULT_PROMPT, buildSystemPrompt, CANVAS_GUIDANCE } from "./system-prompt";

// Resolves the exact system prompt a code-session run sends: settings override
// (or default) + cwd + [Skills] titles + inline instructions. Shared by the
// agent loop and the GET /system-prompt endpoint so the UI block shows what the
// model actually receives.

export interface ResolvedInstruction {
  id: string;
  instruction: string;
}

export interface ResolvedMemory {
  id: string;
  scope: string;
  content: string;
}

export interface SessionPromptResolution {
  systemPrompt: string;
  skills: SessionSkill[];
  instructions: ResolvedInstruction[];
  memories: ResolvedMemory[];
  /** MCP tools available to the session — listed in the prompt, called by name. */
  mcpTools: { server: string; name: string }[];
  /** Matching MCP servers that could not be reached — surfaced in the UI block. */
  mcpFailures: { server: string; error: string }[];
}

export interface ResolveSessionPromptInput {
  organizationId: string;
  sessionId: string;
  codeDirectoryId: string | null;
  sessionTags: string[];
  runnerId: string | null;
  cwd: string | null;
  /** Bound-agent prompt — beats the org override; blank falls through. */
  systemPromptOverride?: string | null;
  /** Replaces the org/code default body when set (assistant keeps its canvas default). */
  defaultPrompt?: string;
  /** "assistant" = directory-less code session: assistant persona, canvas section. */
  mode?: "code" | "assistant";
}

function instructionsSection(instructions: ResolvedInstruction[]): string {
  return instructions.map((i) => `<instruction>\n${i.instruction}\n</instruction>`).join("\n");
}

function memoriesSection(memories: ResolvedMemory[]): string {
  return ["Long-lived facts the user wants recalled — workspace-wide, for this project, or for this session:", ...memories.map((m) => `- ${m.content}`)].join(
    "\n",
  );
}

/**
 * Memories injected like skills: scope=workspace always; scope=project when its
 * directory is the session's; scope=session when bound to this session's id.
 */
export async function listSessionMemories(organizationId: string, codeDirectoryId: string | null, sessionId: string): Promise<ResolvedMemory[]> {
  const rows = await db
    .selectFrom("memory")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where((eb) =>
      eb.or([
        eb("scope", "=", "workspace"),
        ...(codeDirectoryId ? [eb.and([eb("scope", "=", "project"), eb("codeDirectoryId", "=", codeDirectoryId)])] : []),
        eb.and([eb("scope", "=", "session"), eb("scopeId", "=", sessionId)]),
      ]),
    )
    .orderBy("createdAt", "asc")
    .execute();
  return rows.map((r) => ({ id: r.id, scope: r.scope, content: r.content }));
}

/**
 * Pathless instructions tagged "default" (or with a session tag) are inlined
 * into the system prompt; path-based ones are left for future file loading.
 */
export async function listSessionInstructions(organizationId: string, codeDirectoryId: string | null, sessionTags: string[]): Promise<ResolvedInstruction[]> {
  const rows = await db
    .selectFrom("instruction")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("instructionPath", "is", null)
    .where((eb) => eb.or([eb("codeDirectoryId", "is", null), ...(codeDirectoryId ? [eb("codeDirectoryId", "=", codeDirectoryId)] : [])]))
    .execute();
  return rows
    .filter((r) => r.tags.includes(DEFAULT_SKILL_TAG) || r.tags.some((t) => sessionTags.includes(t)))
    .map((r) => ({ id: r.id, instruction: r.instruction }));
}

export async function resolveSessionSystemPrompt(input: ResolveSessionPromptInput): Promise<SessionPromptResolution> {
  const settings = await getCodeSettings(input.organizationId);
  const skills = [
    ...(await listSessionDbSkills(input.organizationId, input.codeDirectoryId, input.sessionTags)),
    ...(await listRepoSkills(input.runnerId, input.cwd, enabledRepoSources(settings.skillSources))),
  ];
  const instructions = await listSessionInstructions(input.organizationId, input.codeDirectoryId, input.sessionTags);
  const memories = await listSessionMemories(input.organizationId, input.codeDirectoryId, input.sessionId);
  // MCP tools join code sessions only; the network fetch must never break
  // prompt resolution — failures become a listed note instead.
  const mcp = input.mode === "assistant" ? { tools: [] as McpTool[], failures: [] } : await loadSessionMcpTools(input.organizationId, input.codeDirectoryId, input.sessionTags);
  const mcpTools = mcp.tools.map((t) => ({ server: t.serverName, name: t.remoteName }));
  const mcpFailures = mcp.failures;
  // Precedence: agent prompt → mode default (assistant persona) → org override
  // → hardcoded default. A blank agent prompt falls through.
  const modeDefault = input.mode === "assistant" ? ASSISTANT_DEFAULT_PROMPT : null;
  const promptBody = input.systemPromptOverride?.trim() ? input.systemPromptOverride : (input.defaultPrompt ?? modeDefault ?? settings.systemPrompt);
  const systemPrompt = buildSystemPrompt(promptBody, input.cwd, {
    skills: formatSkillsForPrompt(skills),
    instructions: instructionsSection(instructions),
    memories: memories.length ? memoriesSection(memories) : "",
    mcp: formatMcpForPrompt(mcp.tools),
    // update_canvas is offered in every chat flavor, so guidance rides along.
    canvas: CANVAS_GUIDANCE,
  });
  return { systemPrompt, skills, instructions, memories, mcpTools, mcpFailures };
}
