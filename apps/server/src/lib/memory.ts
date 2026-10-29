import type { Selectable } from "kysely";
import { db } from "../auth";
import type { AgentTool } from "./agent";
import type { MemoryScope, MemoryTable } from "../plugins/db";
import { getDirectorySpaceId, spaceMatches } from "./spaces";

/**
 * Agent memory, at several levels:
 *   organization    — every agent in the org
 *   code_directory  — agents working in that directory
 *   agent ("self")  — one persona / collaborator / sentinel's own memory
 *   session         — legacy: bound to a single code session
 *
 * What an agent sees:
 *   default agent (main session)       → organization + current code_directory
 *   persona / collaborator / sentinel  → organization + its own + code_directory (when configured)
 *   sub_agent                          → exactly what its calling parent sees (walks up the parent chain)
 *
 * A memory is a title + content. Titles are listed by default; content is read on demand.
 */

export type MemoryRow = Selectable<MemoryTable>;

/** Level names as the tools and UI speak them ("self" is stored as scope "agent"). */
export type MemoryLevel = "organization" | "code_directory" | "self" | "session";

export const MEMORY_LEVELS: MemoryLevel[] = ["organization", "code_directory", "self", "session"];

const SCOPE_BY_LEVEL: Record<MemoryLevel, MemoryScope> = {
  organization: "organization",
  code_directory: "code_directory",
  self: "agent",
  session: "session",
};

export function levelOf(row: Pick<MemoryRow, "scope">): MemoryLevel {
  return row.scope === "agent" ? "self" : row.scope;
}

const MAX_SUBAGENT_WALK = 6;
export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 20_000;

/** Who a run's memory belongs to. */
export interface MemoryContext {
  organizationId: string;
  /** The session whose directory/identity applies — the root of a sub_agent chain. */
  sessionId: string;
  codeDirectoryId: string | null;
  /** The persona / collaborator / sentinel whose "self" memory applies; null for the default agent. */
  selfAgentId: string | null;
  spaceId: string | null;
}

/** Resolves the memory context for a session, walking up from sub_agent children to the agent that invoked them. */
export async function resolveMemoryContext(organizationId: string, sessionId: string): Promise<MemoryContext | null> {
  let current = await db
    .selectFrom("code_session")
    .select(["id", "codeDirectoryId", "agentId", "parentSessionId"])
    .where("id", "=", sessionId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!current) return null;

  for (let hop = 0; hop < MAX_SUBAGENT_WALK; hop++) {
    const agent = current.agentId
      ? await db.selectFrom("agent").select(["id", "type"]).where("id", "=", current.agentId).where("organizationId", "=", organizationId).executeTakeFirst()
      : undefined;
    if (agent?.type === "sub_agent" && current.parentSessionId) {
      const parent = await db
        .selectFrom("code_session")
        .select(["id", "codeDirectoryId", "agentId", "parentSessionId"])
        .where("id", "=", current.parentSessionId)
        .where("organizationId", "=", organizationId)
        .executeTakeFirst();
      if (!parent) break;
      current = parent;
      continue;
    }
    return {
      organizationId,
      sessionId: current.id,
      codeDirectoryId: current.codeDirectoryId,
      selfAgentId: agent && agent.type !== "sub_agent" ? agent.id : null,
      spaceId: await getDirectorySpaceId(organizationId, current.codeDirectoryId),
    };
  }
  // A broken parent link or a chain deeper than the cap: fall back to the session itself, with no self memory.
  return { organizationId, sessionId: current.id, codeDirectoryId: current.codeDirectoryId, selfAgentId: null, spaceId: await getDirectorySpaceId(organizationId, current.codeDirectoryId) };
}

const LEVEL_ORDER: Record<MemoryLevel, number> = { organization: 0, code_directory: 1, self: 2, session: 3 };

/** Every memory the context applies to, organization first, then by creation order. */
export async function listApplicableMemories(ctx: MemoryContext): Promise<MemoryRow[]> {
  const rows = await db
    .selectFrom("memory")
    .selectAll()
    .where("organizationId", "=", ctx.organizationId)
    .where((eb) =>
      eb.or([
        eb("scope", "=", "organization"),
        ...(ctx.codeDirectoryId ? [eb.and([eb("scope", "=", "code_directory"), eb("codeDirectoryId", "=", ctx.codeDirectoryId)])] : []),
        ...(ctx.selfAgentId ? [eb.and([eb("scope", "=", "agent"), eb("agentId", "=", ctx.selfAgentId)])] : []),
        eb.and([eb("scope", "=", "session"), eb("scopeId", "=", ctx.sessionId)]),
      ]),
    )
    .orderBy("createdAt", "asc")
    .execute();
  return rows
    .filter((r) => spaceMatches(r.spaceId, ctx.spaceId))
    .sort((a, b) => LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)]);
}

/** Shortcut for callers that only have a session id (system prompt, REST). */
export async function listSessionMemories(organizationId: string, sessionId: string): Promise<MemoryRow[]> {
  const ctx = await resolveMemoryContext(organizationId, sessionId);
  return ctx ? listApplicableMemories(ctx) : [];
}

// ---------------------------------------------------------------------------
// Titles

export function normalizeTitle(value: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: "title is required" };
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `title is too long (max ${MAX_TITLE_LENGTH} characters)` };
  return { ok: true, title };
}

export function normalizeContent(value: unknown): { ok: true; content: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: "content is required" };
  if (value.length > MAX_CONTENT_LENGTH) return { ok: false, error: `content is too long (max ${MAX_CONTENT_LENGTH} characters)` };
  return { ok: true, content: value.trim() };
}

/** Where a memory lives — the unique-title boundary. */
export interface MemoryPlace {
  organizationId: string;
  scope: MemoryScope;
  codeDirectoryId: string | null;
  agentId: string | null;
  scopeId: string | null;
}

/** True when another memory at the same place already uses this title (case-insensitive). */
export async function titleTaken(place: MemoryPlace, title: string, exceptId?: string): Promise<boolean> {
  let query = db
    .selectFrom("memory")
    .select("id")
    .where("organizationId", "=", place.organizationId)
    .where("scope", "=", place.scope)
    .where((eb) => eb(eb.fn("lower", ["title"]), "=", title.toLowerCase()));
  query = place.codeDirectoryId ? query.where("codeDirectoryId", "=", place.codeDirectoryId) : query.where("codeDirectoryId", "is", null);
  query = place.agentId ? query.where("agentId", "=", place.agentId) : query.where("agentId", "is", null);
  query = place.scopeId ? query.where("scopeId", "=", place.scopeId) : query.where("scopeId", "is", null);
  if (exceptId) query = query.where("id", "<>", exceptId);
  return !!(await query.executeTakeFirst());
}

// ---------------------------------------------------------------------------
// Tools

export const GET_MEMORIES_TOOL: AgentTool = {
  name: "get_memories",
  description:
    "Lists the titles of every memory available to you, with the level each lives at (organization, code_directory, self). Use read_memory to get a memory's content.",
  scope: ["code", "assistant"],
  parameters: { type: "object", properties: {} },
};

export const READ_MEMORY_TOOL: AgentTool = {
  name: "read_memory",
  description: "Returns the content of a memory by its title, exactly as listed by get_memories.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Memory title" },
      level: { type: "string", enum: ["organization", "code_directory", "self"], description: "Only needed when two levels share the same title" },
    },
    required: ["title"],
  },
};

export const ADD_MEMORY_TOOL: AgentTool = {
  name: "add_memory",
  description:
    "Saves a memory worth keeping across sessions: a short descriptive title plus its content. Default level is 'self' for persona/collaborator/sentinel agents, otherwise 'code_directory' (or 'organization' when there is no directory). Use 'organization' only for facts every agent should know.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short unique title" },
      content: { type: "string", description: "What to remember" },
      level: { type: "string", enum: ["organization", "code_directory", "self"], description: "Where to store it (optional)" },
    },
    required: ["title", "content"],
  },
};

export const UPDATE_MEMORY_TOOL: AgentTool = {
  name: "update_memory",
  description: "Updates a memory found by its current title: pass new_title and/or content to change them.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Current title of the memory" },
      new_title: { type: "string", description: "New title (optional)" },
      content: { type: "string", description: "New content, replacing the old (optional)" },
      level: { type: "string", enum: ["organization", "code_directory", "self"], description: "Only needed when two levels share the same title" },
    },
    required: ["title"],
  },
};

export const DELETE_MEMORY_TOOL: AgentTool = {
  name: "delete_memory",
  description: "Deletes a memory by its title.",
  scope: ["code", "assistant"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Memory title" },
      level: { type: "string", enum: ["organization", "code_directory", "self"], description: "Only needed when two levels share the same title" },
    },
    required: ["title"],
  },
};

export const MEMORY_TOOLS: AgentTool[] = [GET_MEMORIES_TOOL, READ_MEMORY_TOOL, ADD_MEMORY_TOOL, UPDATE_MEMORY_TOOL, DELETE_MEMORY_TOOL];

export const MEMORY_TOOL_NAMES = new Set(MEMORY_TOOLS.map((t) => t.name));

export interface MemoryExecution {
  output: string;
  failed: boolean;
}

const fail = (output: string): MemoryExecution => ({ output: `error: ${output}`, failed: true });

const str = (v: unknown) => (typeof v === "string" ? v : "");

function parseLevel(value: unknown): MemoryLevel | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" && (["organization", "code_directory", "self"] as string[]).includes(value) ? (value as MemoryLevel) : "invalid";
}

/** Finds the one memory a title (and optional level) points at, or explains why not. */
function pick(memories: MemoryRow[], title: string, level: MemoryLevel | null): { row: MemoryRow } | { error: string } {
  const wanted = title.trim().toLowerCase();
  const matches = memories.filter((m) => m.title.toLowerCase() === wanted && (!level || levelOf(m) === level));
  if (matches.length === 0) return { error: `no memory titled "${title}"${level ? ` at level ${level}` : ""} — call get_memories for the list` };
  if (matches.length > 1) return { error: `"${title}" exists at several levels (${matches.map(levelOf).join(", ")}) — pass level` };
  return { row: matches[0] };
}

/** Runs one memory tool call against the calling session's memory context. */
export async function executeMemoryTool(organizationId: string, sessionId: string, name: string, args: Record<string, unknown>): Promise<MemoryExecution> {
  const ctx = await resolveMemoryContext(organizationId, sessionId);
  if (!ctx) return fail("session not found");
  const memories = await listApplicableMemories(ctx);

  if (name === "get_memories") {
    if (memories.length === 0) return { output: "no memories saved yet", failed: false };
    return { output: memories.map((m) => `- ${m.title} (${levelOf(m)})`).join("\n"), failed: false };
  }

  const title = str(args.title);
  if (!title.trim()) return fail(`${name} requires a title`);
  const level = parseLevel(args.level);
  if (level === "invalid") return fail("level must be organization, code_directory or self");

  if (name === "read_memory") {
    const found = pick(memories, title, level);
    return "error" in found ? fail(found.error) : { output: found.row.content, failed: false };
  }

  if (name === "add_memory") {
    const t = normalizeTitle(title);
    if (!t.ok) return fail(t.error);
    const c = normalizeContent(args.content);
    if (!c.ok) return fail(c.error);
    const target: MemoryLevel = level ?? (ctx.selfAgentId ? "self" : ctx.codeDirectoryId ? "code_directory" : "organization");
    if (target === "self" && !ctx.selfAgentId) return fail("only persona, collaborator and sentinel agents have their own memory — use code_directory or organization");
    if (target === "code_directory" && !ctx.codeDirectoryId) return fail("this session has no code directory — use organization");
    if (memories.some((m) => m.title.toLowerCase() === t.title.toLowerCase())) return fail(`a memory titled "${t.title}" already exists — use update_memory`);
    const now = new Date();
    await db
      .insertInto("memory")
      .values({
        id: crypto.randomUUID(),
        organizationId,
        codeDirectoryId: target === "code_directory" ? ctx.codeDirectoryId : null,
        spaceId: null,
        scopeId: null,
        scope: SCOPE_BY_LEVEL[target],
        agentId: target === "self" ? ctx.selfAgentId : null,
        title: t.title,
        content: c.content,
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    return { output: `saved "${t.title}" (${target})`, failed: false };
  }

  const found = pick(memories, title, level);
  if ("error" in found) return fail(found.error);
  const row = found.row;

  if (name === "delete_memory") {
    await db.deleteFrom("memory").where("id", "=", row.id).where("organizationId", "=", organizationId).execute();
    return { output: `deleted "${row.title}" (${levelOf(row)})`, failed: false };
  }

  if (name === "update_memory") {
    const patch: { title?: string; content?: string } = {};
    if (args.new_title !== undefined) {
      const t = normalizeTitle(args.new_title);
      if (!t.ok) return fail(t.error);
      if (t.title.toLowerCase() !== row.title.toLowerCase() && (await titleTaken(row, t.title, row.id))) return fail(`a memory titled "${t.title}" already exists at that level`);
      patch.title = t.title;
    }
    if (args.content !== undefined) {
      const c = normalizeContent(args.content);
      if (!c.ok) return fail(c.error);
      patch.content = c.content;
    }
    if (Object.keys(patch).length === 0) return fail("update_memory needs new_title and/or content");
    await db.updateTable("memory").set({ ...patch, updatedAt: new Date() }).where("id", "=", row.id).execute();
    return { output: `updated "${row.title}"${patch.title ? ` → "${patch.title}"` : ""}`, failed: false };
  }

  return fail(`unknown memory tool ${name}`);
}
