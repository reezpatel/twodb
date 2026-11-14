import type { AgentRow, MemoryRow, SessionRow } from "./db/schema.js";
import type { ArtisanRepo } from "./db/repository.js";

/**
 * Agent memory, at four levels:
 *   organization    — every agent in the workspace
 *   code_directory  — agents working in that directory
 *   self            — one persona / collaborator's own memory
 *   session         — this session only. Survives compaction and new threads, so it
 *                     is the place for working notes that must outlive the transcript.
 *
 * What an agent sees:
 *   directory agent (default)  → organization + its directory + this session
 *   persona / collaborator     → organization + its own + its directory + this session
 *   sub_agent                  → exactly what its caller sees (walks up the parent chain)
 *
 * A memory is a title + content. Titles go in the prompt; content is read on demand.
 */

export type MemoryLevel = "organization" | "code_directory" | "self" | "session";
export const MEMORY_LEVELS: MemoryLevel[] = ["organization", "code_directory", "self", "session"];
export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 20_000;
const MAX_WALK = 6;

export const isLevel = (v: unknown): v is MemoryLevel => typeof v === "string" && (MEMORY_LEVELS as string[]).includes(v);

/** Who a run's memory belongs to. */
export interface MemoryContext {
  workspaceId: string;
  /** The session whose identity applies — the root of a sub_agent chain. */
  sessionId: string;
  directoryId: string | null;
  /** The persona / collaborator whose "self" memory applies; null for directory agents. */
  selfAgentId: string | null;
}

/** Resolves a session's memory context, walking sub_agent children up to the session that invoked them. */
export async function resolveMemoryContext(repo: ArtisanRepo, workspaceId: string, sessionId: string): Promise<MemoryContext | null> {
  let current: SessionRow | undefined = await repo.getSession(workspaceId, sessionId);
  if (!current) return null;
  for (let hop = 0; hop < MAX_WALK; hop++) {
    const agent: AgentRow | undefined = current.agent_id ? await repo.getAgent(workspaceId, current.agent_id) : undefined;
    const isSub = agent ? agent.type === "sub_agent" : !!current.parent_session_id; // ad-hoc children inherit too
    if (isSub && current.parent_session_id) {
      const parent: SessionRow | undefined = await repo.getSession(workspaceId, current.parent_session_id);
      if (!parent) break;
      current = parent;
      continue;
    }
    const hasSelf = agent && agent.type !== "sub_agent" && agent.type !== "directory";
    return { workspaceId, sessionId: current.id, directoryId: current.directory_id, selfAgentId: hasSelf ? agent.id : null };
  }
  return { workspaceId, sessionId: current.id, directoryId: current.directory_id, selfAgentId: null };
}

const ORDER: Record<string, number> = { organization: 0, code_directory: 1, self: 2, session: 3 };

/** Every memory the context applies to — organization first, then by creation order. */
export async function applicableMemories(repo: ArtisanRepo, ctx: MemoryContext): Promise<MemoryRow[]> {
  const rows = await repo.listMemories(ctx.workspaceId, { directoryId: ctx.directoryId, agentId: ctx.selfAgentId, sessionId: ctx.sessionId });
  return rows.sort((a, b) => (ORDER[a.level] ?? 9) - (ORDER[b.level] ?? 9));
}

export async function sessionMemories(repo: ArtisanRepo, workspaceId: string, sessionId: string): Promise<MemoryRow[]> {
  const ctx = await resolveMemoryContext(repo, workspaceId, sessionId);
  return ctx ? applicableMemories(repo, ctx) : [];
}

export function normalizeTitle(v: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof v !== "string" || !v.trim()) return { ok: false, error: "title is required" };
  const title = v.trim().replace(/\s+/g, " ");
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `title is too long (max ${MAX_TITLE_LENGTH} characters)` };
  return { ok: true, title };
}

export function normalizeContent(v: unknown): { ok: true; content: string } | { ok: false; error: string } {
  if (typeof v !== "string" || !v.trim()) return { ok: false, error: "content is required" };
  if (v.length > MAX_CONTENT_LENGTH) return { ok: false, error: `content is too long (max ${MAX_CONTENT_LENGTH} characters)` };
  return { ok: true, content: v.trim() };
}

/** True when another memory at the same place already uses this title (case-insensitive). */
export function titleTaken(all: MemoryRow[], place: Pick<MemoryRow, "level" | "directory_id" | "agent_id" | "session_id">, title: string, exceptId?: string): boolean {
  const t = title.toLowerCase();
  return all.some(
    (m) =>
      m.id !== exceptId &&
      m.level === place.level &&
      m.directory_id === place.directory_id &&
      m.agent_id === place.agent_id &&
      m.session_id === place.session_id &&
      m.title.toLowerCase() === t,
  );
}

/** The `## Memory` block of the system prompt — titles and levels only. */
export function memoryPrompt(memories: MemoryRow[]): string {
  const head =
    "Long-lived memories — organization-wide, for this directory, your own, or this session. Only titles are listed; call read_memory to get the content, get_memories for the current list. " +
    "Save durable facts with add_memory. Use level 'session' for working notes you want to keep after the context is compacted.";
  return `\n## Memory\n${head}\n${memories.length ? memories.map((m) => `- ${m.title} (${m.level})`).join("\n") : "(none saved yet)"}`;
}
