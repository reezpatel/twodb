import type { ToolContext, ToolSpec } from "../agent-loop.js";
import {
  applicableMemories, isLevel, normalizeContent, normalizeTitle, resolveMemoryContext, titleTaken,
  type MemoryLevel,
} from "../../memory.js";
import type { MemoryRow } from "../../db/schema.js";

const LEVELS = ["organization", "code_directory", "self", "session"];
const levelProp = (desc: string) => ({ type: "string", enum: LEVELS, description: desc });

export const MEMORY_TOOL_NAMES = ["get_memories", "read_memory", "add_memory", "update_memory", "delete_memory"];

const fail = (msg: string) => `error: ${msg}`;

/** Finds the one memory a title (and optional level) points at, or explains why not. */
function pick(memories: MemoryRow[], title: string, level: MemoryLevel | null): { row: MemoryRow } | { error: string } {
  const wanted = title.trim().toLowerCase();
  const matches = memories.filter((m) => m.title.toLowerCase() === wanted && (!level || m.level === level));
  if (matches.length === 0) return { error: `no memory titled "${title}"${level ? ` at level ${level}` : ""} — call get_memories for the list` };
  if (matches.length > 1) return { error: `"${title}" exists at several levels (${matches.map((m) => m.level).join(", ")}) — pass level` };
  return { row: matches[0] };
}

async function load(ctx: ToolContext) {
  const mctx = await resolveMemoryContext(ctx.repo, ctx.session.workspace_id, ctx.session.id);
  if (!mctx) return null;
  return { mctx, memories: await applicableMemories(ctx.repo, mctx) };
}

function levelArg(v: unknown): MemoryLevel | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  return isLevel(v) ? v : "invalid";
}

export function memoryTools(): ToolSpec[] {
  return [
    {
      name: "get_memories",
      description: "Lists the titles of every memory available to you, with the level each lives at (organization, code_directory, self, session). Use read_memory to get a memory's content.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx) {
        const l = await load(ctx);
        if (!l) return fail("session not found");
        return l.memories.length ? l.memories.map((m) => `- ${m.title} (${m.level})`).join("\n") : "no memories saved yet";
      },
    },
    {
      name: "read_memory",
      description: "Returns the content of a memory by its title, exactly as listed by get_memories.",
      parameters: {
        type: "object",
        properties: { title: { type: "string", description: "Memory title" }, level: levelProp("Only needed when two levels share the same title") },
        required: ["title"],
      },
      async execute(args, ctx) {
        const level = levelArg(args.level);
        if (level === "invalid") return fail(`level must be one of ${LEVELS.join(", ")}`);
        const l = await load(ctx);
        if (!l) return fail("session not found");
        const found = pick(l.memories, String(args.title ?? ""), level);
        return "error" in found ? fail(found.error) : found.row.content;
      },
    },
    {
      name: "add_memory",
      description:
        "Saves a memory worth keeping: a short descriptive title plus its content. Default level is 'self' for persona/collaborator agents, otherwise 'code_directory' (or 'organization' when there is no directory). " +
        "Use 'session' for working notes that only matter in this session — they survive compaction. Use 'organization' only for facts every agent should know.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short unique title" },
          content: { type: "string", description: "What to remember" },
          level: levelProp("Where to store it (optional)"),
        },
        required: ["title", "content"],
      },
      async execute(args, ctx) {
        const level = levelArg(args.level);
        if (level === "invalid") return fail(`level must be one of ${LEVELS.join(", ")}`);
        const t = normalizeTitle(args.title);
        if (!t.ok) return fail(t.error);
        const c = normalizeContent(args.content);
        if (!c.ok) return fail(c.error);
        const l = await load(ctx);
        if (!l) return fail("session not found");
        const { mctx } = l;
        const target: MemoryLevel = level ?? (mctx.selfAgentId ? "self" : mctx.directoryId ? "code_directory" : "organization");
        if (target === "self" && !mctx.selfAgentId) return fail("only persona and collaborator agents have their own memory — use session, code_directory or organization");
        if (target === "code_directory" && !mctx.directoryId) return fail("this session has no registered directory — use session or organization");
        if (l.memories.some((m) => m.title.toLowerCase() === t.title.toLowerCase())) return fail(`a memory titled "${t.title}" already exists — use update_memory`);
        await ctx.repo.createMemory({
          workspaceId: ctx.session.workspace_id, level: target, title: t.title, content: c.content,
          directoryId: mctx.directoryId, agentId: mctx.selfAgentId, sessionId: mctx.sessionId,
        });
        return `saved "${t.title}" (${target})`;
      },
    },
    {
      name: "update_memory",
      description: "Updates a memory found by its current title: pass new_title and/or content to change them.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Current title of the memory" },
          new_title: { type: "string", description: "New title (optional)" },
          content: { type: "string", description: "New content, replacing the old (optional)" },
          level: levelProp("Only needed when two levels share the same title"),
        },
        required: ["title"],
      },
      async execute(args, ctx) {
        const level = levelArg(args.level);
        if (level === "invalid") return fail(`level must be one of ${LEVELS.join(", ")}`);
        const l = await load(ctx);
        if (!l) return fail("session not found");
        const found = pick(l.memories, String(args.title ?? ""), level);
        if ("error" in found) return fail(found.error);
        const row = found.row;
        const patch: { title?: string; content?: string } = {};
        if (args.new_title !== undefined) {
          const t = normalizeTitle(args.new_title);
          if (!t.ok) return fail(t.error);
          if (t.title.toLowerCase() !== row.title.toLowerCase() && titleTaken(await ctx.repo.listAllMemories(row.workspace_id), row, t.title, row.id)) {
            return fail(`a memory titled "${t.title}" already exists at that level`);
          }
          patch.title = t.title;
        }
        if (args.content !== undefined) {
          const c = normalizeContent(args.content);
          if (!c.ok) return fail(c.error);
          patch.content = c.content;
        }
        if (Object.keys(patch).length === 0) return fail("update_memory needs new_title and/or content");
        await ctx.repo.updateMemory(row.workspace_id, row.id, patch);
        return `updated "${row.title}"${patch.title ? ` → "${patch.title}"` : ""}`;
      },
    },
    {
      name: "delete_memory",
      description: "Deletes a memory by its title.",
      parameters: {
        type: "object",
        properties: { title: { type: "string", description: "Memory title" }, level: levelProp("Only needed when two levels share the same title") },
        required: ["title"],
      },
      async execute(args, ctx) {
        const level = levelArg(args.level);
        if (level === "invalid") return fail(`level must be one of ${LEVELS.join(", ")}`);
        const l = await load(ctx);
        if (!l) return fail("session not found");
        const found = pick(l.memories, String(args.title ?? ""), level);
        if ("error" in found) return fail(found.error);
        await ctx.repo.deleteMemory(found.row.workspace_id, found.row.id);
        return `deleted "${found.row.title}" (${found.row.level})`;
      },
    },
  ];
}
