import { db } from "../auth";
import { getCodeSettings } from "./code-settings";
import { spaceMatches } from "./spaces";
import { levelOf, listSessionMemories, type MemoryLevel } from "./memory";
import { DEFAULT_SKILL_TAG, enabledRepoSources, formatSkillsForPrompt, listRepoSkills, listSessionDbSkills, type SessionSkill } from "./skills";
import { formatMcpForPrompt, loadSessionMcpTools, type McpTool } from "./mcp";
import { ASSISTANT_DEFAULT_PROMPT, buildSystemPrompt, CANVAS_GUIDANCE, NON_INTERACTIVE_GUIDANCE } from "./system-prompt";

// Resolves the exact system prompt a code-session run sends: settings override
// (or default) + cwd + [Skills] titles + inline instructions. Shared by the
// agent loop and the GET /system-prompt endpoint so the UI block shows what the
// model actually receives.

export interface ResolvedInstruction {
  id: string;
  instruction: string;
}

/** A memory as the prompt and UI list it: title and level only — content is read on demand. */
export interface ResolvedMemory {
  id: string;
  title: string;
  level: MemoryLevel;
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
  /** The session's space — resources match by it (null = base resources only). */
  spaceId: string | null;
  runnerId: string | null;
  cwd: string | null;
  /** Bound-agent prompt — beats the org override; blank falls through. */
  systemPromptOverride?: string | null;
  /** Replaces the org/code default body when set (assistant keeps its canvas default). */
  defaultPrompt?: string;
  /** "assistant" = directory-less code session: assistant persona, canvas section. */
  mode?: "code" | "assistant";
  /** false → headless subagent run: ask_user disabled, non-interactive guidance appended. */
  interactive?: boolean;
}

function instructionsSection(instructions: ResolvedInstruction[]): string {
  return instructions.map((i) => `<instruction>\n${i.instruction}\n</instruction>`).join("\n");
}

function memoriesSection(memories: ResolvedMemory[]): string {
  return [
    "Long-lived memories saved for you — organization-wide, for this directory, or your own. Only titles are listed; call read_memory with a title to get its content, and get_memories for the current list. Save durable facts with add_memory.",
    ...memories.map((m) => `- ${m.title} (${m.level})`),
  ].join("\n");
}

/**
 * Pathless instructions tagged "default" (or with a session tag) are inlined
 * into the system prompt; path-based ones are left for future file loading.
 */
export async function listSessionInstructions(organizationId: string, codeDirectoryId: string | null, sessionTags: string[], spaceId: string | null): Promise<ResolvedInstruction[]> {
  const rows = await db
    .selectFrom("instruction")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("instructionPath", "is", null)
    .where((eb) => eb.or([eb("codeDirectoryId", "is", null), ...(codeDirectoryId ? [eb("codeDirectoryId", "=", codeDirectoryId)] : [])]))
    .execute();
  return rows
    .filter((r) => spaceMatches(r.spaceId, spaceId))
    .filter((r) => r.tags.includes(DEFAULT_SKILL_TAG) || r.tags.some((t) => sessionTags.includes(t)))
    .map((r) => ({ id: r.id, instruction: r.instruction }));
}

export async function resolveSessionSystemPrompt(input: ResolveSessionPromptInput): Promise<SessionPromptResolution> {
  const settings = await getCodeSettings(input.organizationId);
  const skills = [
    ...(await listSessionDbSkills(input.organizationId, input.codeDirectoryId, input.sessionTags, input.spaceId)),
    ...(await listRepoSkills(input.runnerId, input.cwd, enabledRepoSources(settings.skillSources))),
  ];
  const instructions = await listSessionInstructions(input.organizationId, input.codeDirectoryId, input.sessionTags, input.spaceId);
  const memories: ResolvedMemory[] = (await listSessionMemories(input.organizationId, input.sessionId)).map((m) => ({ id: m.id, title: m.title, level: levelOf(m) }));
  // MCP tools join code sessions only; the network fetch must never break
  // prompt resolution — failures become a listed note instead.
  const mcp = input.mode === "assistant" ? { tools: [] as McpTool[], failures: [] } : await loadSessionMcpTools(input.organizationId, input.codeDirectoryId, input.sessionTags, input.spaceId);
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
    // Headless subagent runs never get ask_user — the section says so too.
    nonInteractive: input.interactive === false ? NON_INTERACTIVE_GUIDANCE : undefined,
  });
  return { systemPrompt, skills, instructions, memories, mcpTools, mcpFailures };
}
