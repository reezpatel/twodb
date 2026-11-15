import type { Kysely } from "kysely";
import { sql } from "kysely";
import { createHash } from "node:crypto";
import { ulid } from "ulid";
import type { SkillScope } from "../skills.js";
import type { McpScope } from "../mcp.js";
import type { AgentRow, ArtisanDb, CanvasRow, CheckpointRow, DirectoryRow, McpServerRow, MemoryRow, MessageRow, SessionRow, SessionUsageRow, SkillRow, ThreadRow } from "./schema.js";

export function newId(): string {
  return ulid().toLowerCase();
}

export function now(): string {
  return new Date().toISOString();
}

export interface ArtisanRepo {
  // sessions
  createSession(input: {
    workspaceId: string; spaceId: string; type?: string; title: string;
    runner: string; directory: string; model: string; interactive?: boolean;
    agentId?: string | null; parentSessionId?: string | null; adhocPrompt?: string | null; depth?: number;
    directoryId?: string | null;
  }): Promise<SessionRow>;
  getSession(workspaceId: string, id: string): Promise<SessionRow | undefined>;
  listSessions(workspaceId: string, filter?: { type?: string; runner?: string; directory?: string; spaceId?: string; parentSessionId?: string; agentId?: string; archived?: "include" | "only" }): Promise<SessionRow[]>;
  /** Unfiltered (every type) — admin/parent views. */
  listSessionsAll(workspaceId: string, parentSessionId?: string): Promise<SessionRow[]>;
  touchSession(id: string): Promise<void>;
  renameSession(workspaceId: string, id: string, title: string): Promise<void>;
  setSessionThinkingLevel(workspaceId: string, id: string, level: string | null): Promise<void>;
  setSessionArchived(workspaceId: string, id: string, archived: boolean): Promise<void>;
  /** Deletes the session with its threads, messages, usage and checkpoints. */
  deleteSession(workspaceId: string, id: string): Promise<boolean>;
  setSessionModel(workspaceId: string, id: string, model: string): Promise<void>;
  setSessionPlan(id: string, plan: Array<{ description: string; status: string }> | null): Promise<void>;

  // canvases (metadata only; content is owned by Paintress)
  listCanvases(workspaceId: string, owner: { sessionId?: string; agentId?: string }): Promise<CanvasRow[]>;
  findCanvas(workspaceId: string, owner: { sessionId?: string; agentId?: string }, title: string): Promise<CanvasRow | undefined>;
  createCanvas(input: { workspaceId: string; sessionId?: string | null; agentId?: string | null; type: string; title: string; resourceId: string }): Promise<CanvasRow>;
  touchCanvas(id: string, title?: string): Promise<void>;

  // threads
  openThread(sessionId: string, summary?: string | null): Promise<ThreadRow>;
  currentThread(sessionId: string): Promise<ThreadRow | undefined>;
  closeThread(threadId: string): Promise<void>;
  listThreads(sessionId: string): Promise<ThreadRow[]>;

  // messages
  addMessage(input: {
    threadId: string; sessionId: string; role: string; content: string; meta?: unknown;
  }): Promise<MessageRow>;
  listThreadMessages(threadId: string): Promise<MessageRow[]>;
  listSessionMessages(sessionId: string): Promise<MessageRow[]>;
  updateMessageContent(id: string, content: string, meta?: unknown): Promise<void>;

  // agents
  createAgent(input: {
    workspaceId: string; spaceId: string; spaceIds?: string[]; type: string; name: string; description?: string;
    instruction: string; model?: string | null; tools?: string[]; skillTags?: string[];
    tags?: string[]; runner?: string | null; directory?: string | null;
  }): Promise<AgentRow>;
  getAgent(workspaceId: string, id: string): Promise<AgentRow | undefined>;
  /** Agents visible in a space (an agent can belong to several). */
  listAgents(workspaceId: string, spaceId?: string): Promise<AgentRow[]>;
  /** Directory agent config for (runner, directory) — auto-created on first use. */
  getOrCreateDirectoryAgent(workspaceId: string, spaceId: string, runner: string, directory: string): Promise<AgentRow>;
  updateAgent(workspaceId: string, id: string, patch: Partial<{
    name: string; spaceIds: string[]; description: string; instruction: string; model: string | null;
    tools: string[]; skillTags: string[]; tags: string[]; runner: string | null; directory: string | null;
  }>): Promise<AgentRow | undefined>;
  deleteAgent(workspaceId: string, id: string): Promise<boolean>;

  // skills
  createSkill(input: {
    workspaceId: string; name: string;
    description: string; content: string; scope: SkillScope;
  }): Promise<SkillRow>;
  /** Every skill in the workspace — availability is applied by the caller (skills.ts). */
  listSkills(workspaceId: string): Promise<SkillRow[]>;
  getSkill(workspaceId: string, id: string): Promise<SkillRow | undefined>;
  updateSkill(workspaceId: string, id: string, patch: Partial<{
    name: string; description: string; content: string; scope: SkillScope;
  }>): Promise<SkillRow | undefined>;
  deleteSkill(workspaceId: string, id: string): Promise<boolean>;

  // directories
  createDirectory(input: { workspaceId: string; spaceId: string; runner: string; path: string; title?: string; defaultModel?: string | null; projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } }): Promise<DirectoryRow>;
  getDirectory(workspaceId: string, id: string): Promise<DirectoryRow | undefined>;
  getDirectoryByPath(workspaceId: string, runner: string, path: string): Promise<DirectoryRow | undefined>;
  listDirectories(workspaceId: string): Promise<DirectoryRow[]>;
  updateDirectory(workspaceId: string, id: string, patch: { title?: string; defaultModel?: string | null; spaceId?: string; projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } }): Promise<void>;
  deleteDirectory(workspaceId: string, id: string): Promise<boolean>;

  // checkpoints
  addCheckpoint(input: { workspaceId: string; sessionId: string; runner: string; directory: string; label: string | null; ref: string; commitSha: string; trigger?: string }): Promise<CheckpointRow>;
  listCheckpoints(workspaceId: string, sessionId: string): Promise<CheckpointRow[]>;
  getCheckpoint(workspaceId: string, id: string): Promise<CheckpointRow | undefined>;
  deleteCheckpoint(workspaceId: string, id: string): Promise<boolean>;

  // inspector (short-lived request snapshots)
  saveInspectRound(input: {
    sessionId: string; round: number;
    messages: Array<{ role: string; content: string | null; toolCallId?: string; toolCalls?: unknown }>;
    toolsJson: string;
  }): Promise<string>;
  getInspectRound(sessionId: string, id: string): Promise<{
    id: string; round: number; createdAt: string;
    messages: Array<{ role: string; content: string | null; toolCallId?: string; toolCalls?: unknown }>;
    tools: unknown;
  } | undefined>;
  /** Deletes snapshot rows and blobs not touched since `before` (ISO). Returns rows removed. */
  // workspace settings
  getSetting(workspaceId: string, key: string): Promise<{ value: string; updatedAt: string } | undefined>;
  setSetting(workspaceId: string, key: string, value: string): Promise<{ value: string; updatedAt: string }>;

  // mcp servers
  listMcpServers(workspaceId: string): Promise<McpServerRow[]>;
  getMcpServer(workspaceId: string, id: string): Promise<McpServerRow | undefined>;
  createMcpServer(input: {
    workspaceId: string; name: string; url: string; transport: string; headers: Record<string, string>;
    enabled: boolean; scope: McpScope;
  }): Promise<McpServerRow>;
  updateMcpServer(workspaceId: string, id: string, patch: Partial<{
    name: string; url: string; transport: string; headers: Record<string, string>; enabled: boolean; scope: McpScope;
  }>): Promise<McpServerRow | undefined>;
  deleteMcpServer(workspaceId: string, id: string): Promise<boolean>;

  // memories
  /** Memories at the given owners (organization always; the rest only when an id is passed). */
  listMemories(workspaceId: string, owners: { directoryId?: string | null; agentId?: string | null; sessionId?: string | null }): Promise<MemoryRow[]>;
  /** Every memory in the workspace (management UI). */
  listAllMemories(workspaceId: string): Promise<MemoryRow[]>;
  getMemory(workspaceId: string, id: string): Promise<MemoryRow | undefined>;
  createMemory(input: { workspaceId: string; level: string; directoryId?: string | null; agentId?: string | null; sessionId?: string | null; title: string; content: string }): Promise<MemoryRow>;
  updateMemory(workspaceId: string, id: string, patch: { title?: string; content?: string }): Promise<MemoryRow | undefined>;
  deleteMemory(workspaceId: string, id: string): Promise<boolean>;
  purgeInspection(before: string): Promise<{ rounds: number; blobs: number }>;

  // usage
  incrementUsage(sessionId: string, add: { inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number | null }): Promise<void>;
  getUsage(sessionId: string): Promise<SessionUsageRow | undefined>;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function createArtisanRepo(db: Kysely<ArtisanDb>): ArtisanRepo {
  return {
    async createSession(input) {
      const row: SessionRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        type: input.type ?? "directory",
        title: input.title,
        runner: input.runner,
        directory: input.directory,
        directory_id: input.directoryId ?? null,
        model: input.model,
        interactive: input.interactive ?? true,
        agent_id: input.agentId ?? null,
        parent_session_id: input.parentSessionId ?? null,
        adhoc_prompt: input.adhocPrompt ?? null,
        depth: input.depth ?? 0,
        plan_json: null,
        thinking_level: null, archived_at: null,
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("session").values(row).execute();
      await this.openThread(row.id);
      return row;
    },

    async getSession(workspaceId, id) {
      return db.selectFrom("session").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async listSessions(workspaceId, filter) {
      let q = db.selectFrom("session").selectAll().where("workspace_id", "=", workspaceId);
      if (filter?.type) q = q.where("type", "=", filter.type);
      else if (!filter?.agentId) q = q.where("type", "=", "directory");
      if (filter?.agentId) q = q.where("agent_id", "=", filter.agentId);
      if (filter?.runner) q = q.where("runner", "=", filter.runner);
      if (filter?.directory) q = q.where("directory", "=", filter.directory);
      if (filter?.spaceId) q = q.where("space_id", "=", filter.spaceId);
      if (filter?.parentSessionId) q = q.where("parent_session_id", "=", filter.parentSessionId);
      if (filter?.archived === "only") q = q.where("archived_at", "is not", null);
      else if (filter?.archived !== "include") q = q.where("archived_at", "is", null);
      return q.orderBy("updated_at", "desc").execute();
    },

    async listSessionsAll(workspaceId, parentSessionId) {
      let q = db.selectFrom("session").selectAll().where("workspace_id", "=", workspaceId);
      if (parentSessionId) q = q.where("parent_session_id", "=", parentSessionId);
      return q.orderBy("updated_at", "desc").execute();
    },

    async touchSession(id) {
      await db.updateTable("session").set({ updated_at: now() }).where("id", "=", id).execute();
    },

    async renameSession(workspaceId, id, title) {
      await db.updateTable("session").set({ title, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async setSessionThinkingLevel(workspaceId, id, level) {
      await db.updateTable("session").set({ thinking_level: level, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async setSessionArchived(workspaceId, id, archived) {
      await db.updateTable("session").set({ archived_at: archived ? now() : null }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async deleteSession(workspaceId, id) {
      const s = await db.selectFrom("session").select("id").where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
      if (!s) return false;
      await db.deleteFrom("message").where("session_id", "=", id).execute();
      await db.deleteFrom("thread").where("session_id", "=", id).execute();
      await db.deleteFrom("session_usage").where("session_id", "=", id).execute();
      await db.deleteFrom("checkpoint").where("session_id", "=", id).execute();
      await db.deleteFrom("canvas").where("session_id", "=", id).execute();
      await db.deleteFrom("inspect_round").where("session_id", "=", id).execute();
      await db.deleteFrom("inspect_blob").where("session_id", "=", id).execute();
      await db.deleteFrom("memory").where("level", "=", "session").where("session_id", "=", id).execute();
      await db.deleteFrom("session").where("id", "=", id).execute();
      return true;
    },

    async setSessionModel(workspaceId, id, model) {
      await db.updateTable("session").set({ model, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async setSessionPlan(id, plan) {
      await db.updateTable("session").set({ plan_json: plan ? JSON.stringify(plan) : null, updated_at: now() }).where("id", "=", id).execute();
    },

    async listCanvases(workspaceId, owner) {
      let q = db.selectFrom("canvas").selectAll().where("workspace_id", "=", workspaceId);
      if (owner.agentId) q = q.where("agent_id", "=", owner.agentId);
      else if (owner.sessionId) q = q.where("session_id", "=", owner.sessionId);
      else return [];
      return q.orderBy("updated_at", "desc").execute();
    },

    async findCanvas(workspaceId, owner, title) {
      let q = db.selectFrom("canvas").selectAll().where("workspace_id", "=", workspaceId).where("title", "=", title);
      if (owner.agentId) q = q.where("agent_id", "=", owner.agentId);
      else if (owner.sessionId) q = q.where("session_id", "=", owner.sessionId);
      else return undefined;
      return q.executeTakeFirst();
    },

    async createCanvas(input) {
      const row: CanvasRow = {
        id: newId(), workspace_id: input.workspaceId,
        session_id: input.sessionId ?? null, agent_id: input.agentId ?? null,
        type: input.type, title: input.title, resource_id: input.resourceId,
        created_at: now(), updated_at: now(),
      };
      await db.insertInto("canvas").values(row).execute();
      return row;
    },

    async touchCanvas(id, title) {
      await db.updateTable("canvas").set({ ...(title ? { title } : {}), updated_at: now() }).where("id", "=", id).execute();
    },

    async openThread(sessionId, summary) {
      const prev = await db.selectFrom("thread").select(["idx"]).where("session_id", "=", sessionId).execute();
      const idx = prev.length;
      const row: ThreadRow = {
        id: newId(),
        session_id: sessionId,
        idx: idx,
        summary: summary ?? null,
        created_at: now(),
        closed_at: null,
      };
      await db.insertInto("thread").values(row).execute();
      return row;
    },

    async currentThread(sessionId) {
      return db.selectFrom("thread").selectAll().where("session_id", "=", sessionId)
        .orderBy("created_at", "desc").limit(1).executeTakeFirst();
    },

    async closeThread(threadId) {
      await db.updateTable("thread").set({ closed_at: now() }).where("id", "=", threadId).execute();
    },

    async listThreads(sessionId) {
      return db.selectFrom("thread").selectAll().where("session_id", "=", sessionId).orderBy("created_at", "asc").execute();
    },

    async addMessage(input) {
      const last = await db.selectFrom("message").select((eb) => eb.fn.max("idx").as("m"))
        .where("thread_id", "=", input.threadId).executeTakeFirst();
      const row: MessageRow = {
        id: newId(),
        thread_id: input.threadId,
        session_id: input.sessionId,
        idx: last?.m === null || last?.m === undefined ? 0 : Number(last.m) + 1,
        role: input.role,
        content: input.content,
        meta_json: JSON.stringify(input.meta ?? {}),
        created_at: now(),
      };
      await db.insertInto("message").values(row).execute();
      return row;
    },

    async listThreadMessages(threadId) {
      return db.selectFrom("message").selectAll().where("thread_id", "=", threadId).orderBy("idx", "asc").orderBy("created_at", "asc").execute();
    },

    async listSessionMessages(sessionId) {
      return db.selectFrom("message").selectAll().where("session_id", "=", sessionId).orderBy("created_at", "asc").execute();
    },

    async updateMessageContent(id, content, meta) {
      const set: Record<string, string> = { content };
      if (meta !== undefined) set.meta_json = JSON.stringify(meta);
      await db.updateTable("message").set(set).where("id", "=", id).execute();
    },

    async createAgent(input) {
      const row: AgentRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        space_id: (input.spaceIds?.[0] ?? input.spaceId),
        space_ids_json: JSON.stringify(input.spaceIds?.length ? input.spaceIds : [input.spaceId]),
        type: input.type,
        name: input.name,
        description: input.description ?? "",
        instruction: input.instruction,
        model: input.model ?? null,
        tools_json: JSON.stringify(input.tools ?? []),
        skill_tags_json: JSON.stringify(input.skillTags ?? ["default"]),
        tags_json: JSON.stringify(input.tags ?? ["default"]),
        runner: input.runner ?? null,
        directory: input.directory ?? null,
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("agent").values(row).execute();
      return row;
    },

    async getAgent(workspaceId, id) {
      return db.selectFrom("agent").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async listAgents(workspaceId, spaceId) {
      let q = db.selectFrom("agent").selectAll().where("workspace_id", "=", workspaceId);
      if (spaceId) q = q.where((eb) => eb.or([eb("space_id", "=", spaceId), eb("space_ids_json", "like", `%"${spaceId.replace(/[^A-Za-z0-9_-]/g, "")}"%`)]));
      return q.orderBy("created_at", "asc").execute();
    },

    async getOrCreateDirectoryAgent(workspaceId, spaceId, runner, directory) {
      // Directory agents are typed "directory" rows keyed by runner+directory.
      const existing = await db.selectFrom("agent").selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("type", "=", "directory")
        .where("runner", "=", runner)
        .where("directory", "=", directory)
        .executeTakeFirst();
      if (existing) return existing;
      const name = `${runner}:${directory === "/" ? "root" : directory.split("/").filter(Boolean).pop() ?? directory}`;
      const row: AgentRow = {
        id: newId(),
        workspace_id: workspaceId,
        space_id: spaceId,
        space_ids_json: JSON.stringify([spaceId]),
        type: "directory",
        name,
        description: `Default agent for ${directory} on ${runner}`,
        instruction: "",
        model: null,
        tools_json: JSON.stringify([]),
        skill_tags_json: JSON.stringify(["default"]),
        tags_json: JSON.stringify(["default"]),
        runner,
        directory,
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("agent").values(row).execute();
      return row;
    },

    async updateAgent(workspaceId, id, patch) {
      const set: Record<string, string | null> = { updated_at: now() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.spaceIds?.length) {
        set.space_id = patch.spaceIds[0];
        set.space_ids_json = JSON.stringify(patch.spaceIds);
      }
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.instruction !== undefined) set.instruction = patch.instruction;
      if (patch.model !== undefined) set.model = patch.model;
      if (patch.tools !== undefined) set.tools_json = JSON.stringify(patch.tools);
      if (patch.skillTags !== undefined) set.skill_tags_json = JSON.stringify(patch.skillTags);
      if (patch.tags !== undefined) set.tags_json = JSON.stringify(patch.tags);
      if (patch.runner !== undefined) set.runner = patch.runner;
      if (patch.directory !== undefined) set.directory = patch.directory;
      await db.updateTable("agent").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      return this.getAgent(workspaceId, id);
    },

    async deleteAgent(workspaceId, id) {
      const rows = await db.deleteFrom("agent").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      const ok = Number(res?.numDeletedRows ?? 0) > 0;
      if (ok) {
        await db.deleteFrom("memory").where("level", "=", "self").where("agent_id", "=", id).execute();
        await db.deleteFrom("canvas").where("workspace_id", "=", workspaceId).where("agent_id", "=", id).execute();
      }
      return ok;
    },

    async createSkill(input) {
      const row: SkillRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        space_id: null,
        directory: null,
        name: input.name,
        description: input.description,
        content: input.content,
        tags_json: "[\"default\"]",
        scope_mode: input.scope.mode,
        scope_all: input.scope.all || input.scope.mode === "global" ? 1 : 0,
        scope_ids_json: JSON.stringify(input.scope.all ? [] : input.scope.ids),
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("skill").values(row).execute();
      return row;
    },

    async listSkills(workspaceId) {
      return db.selectFrom("skill").selectAll().where("workspace_id", "=", workspaceId).orderBy("name", "asc").execute();
    },

    async getSkill(workspaceId, id) {
      return db.selectFrom("skill").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async updateSkill(workspaceId, id, patch) {
      const set: Record<string, string | null> = { updated_at: now() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.content !== undefined) set.content = patch.content;
      if (patch.scope) {
        set.scope_mode = patch.scope.mode;
        set.scope_all = (patch.scope.all || patch.scope.mode === "global" ? 1 : 0) as never;
        set.scope_ids_json = JSON.stringify(patch.scope.all ? [] : patch.scope.ids);
      }
      await db.updateTable("skill").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      return db.selectFrom("skill").selectAll().where("id", "=", id).executeTakeFirst();
    },

    async deleteSkill(workspaceId, id) {
      const rows = await db.deleteFrom("skill").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      return Number(res?.numDeletedRows ?? 0) > 0;
    },

    async createDirectory(input) {
      const row: DirectoryRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        runner: input.runner,
        path: input.path,
        title: input.title ?? input.path.split("/").filter(Boolean).pop() ?? input.path,
        default_model: input.defaultModel ?? null,
        project_settings_json: JSON.stringify(input.projectSettings ?? { loadAgents: true, loadClaude: false, loadAgentsMd: false }),
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("directory").values(row).execute();
      return row;
    },

    async getDirectory(workspaceId, id) {
      return db.selectFrom("directory").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async getDirectoryByPath(workspaceId, runner, path) {
      return db.selectFrom("directory").selectAll().where("workspace_id", "=", workspaceId).where("runner", "=", runner).where("path", "=", path).executeTakeFirst();
    },

    async listDirectories(workspaceId) {
      return db.selectFrom("directory").selectAll().where("workspace_id", "=", workspaceId).orderBy("title", "asc").execute();
    },

    async updateDirectory(workspaceId, id, patch) {
      const set: Record<string, unknown> = { updated_at: now() };
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.defaultModel !== undefined) set.default_model = patch.defaultModel;
      if (patch.spaceId !== undefined) set.space_id = patch.spaceId;
      if (patch.projectSettings !== undefined) set.project_settings_json = JSON.stringify(patch.projectSettings);
      await db.updateTable("directory").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async deleteDirectory(workspaceId, id) {
      const rows = await db.deleteFrom("directory").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      const ok = Number(res?.numDeletedRows ?? 0) > 0;
      if (ok) await db.deleteFrom("memory").where("level", "=", "code_directory").where("directory_id", "=", id).execute();
      return ok;
    },

    async addCheckpoint(input) {
      const row: CheckpointRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        session_id: input.sessionId,
        runner: input.runner,
        directory: input.directory,
        label: input.label,
        ref: input.ref,
        commit_sha: input.commitSha,
        trigger: input.trigger ?? "manual",
        created_at: now(),
      };
      await db.insertInto("checkpoint").values(row).execute();
      return row;
    },

    async listCheckpoints(workspaceId, sessionId) {
      return db.selectFrom("checkpoint").selectAll().where("workspace_id", "=", workspaceId).where("session_id", "=", sessionId).orderBy("created_at", "desc").execute();
    },

    async getCheckpoint(workspaceId, id) {
      return db.selectFrom("checkpoint").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async saveInspectRound(input) {
      const ts = now();
      const blobs = new Map<string, string>();
      const put = (content: string): string => {
        const hash = createHash("sha1").update(content).digest("hex");
        blobs.set(hash, content);
        return hash;
      };
      const refs = input.messages.map((m) => ({
        role: m.role,
        hash: m.content == null ? null : put(m.content),
        ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
        ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
      }));
      const toolsHash = put(input.toolsJson);
      const rows = [...blobs].map(([hash, content]) => ({ session_id: input.sessionId, hash, content, last_used_at: ts }));
      for (let i = 0; i < rows.length; i += 200) {
        await db.insertInto("inspect_blob").values(rows.slice(i, i + 200))
          .onConflict((oc) => oc.columns(["session_id", "hash"]).doUpdateSet({ last_used_at: ts })).execute();
      }
      const id = newId();
      await db.insertInto("inspect_round").values({
        id, session_id: input.sessionId, round: input.round,
        request_json: JSON.stringify({ messages: refs, toolsHash }), created_at: ts,
      }).execute();
      return id;
    },

    async getInspectRound(sessionId, id) {
      const row = await db.selectFrom("inspect_round").selectAll().where("session_id", "=", sessionId).where("id", "=", id).executeTakeFirst();
      if (!row) return undefined;
      const req = JSON.parse(row.request_json) as {
        messages: Array<{ role: string; hash: string | null; toolCallId?: string; toolCalls?: unknown }>;
        toolsHash: string;
      };
      const hashes = [...new Set([...req.messages.map((m) => m.hash).filter((h): h is string => !!h), req.toolsHash])];
      const content = new Map<string, string>();
      for (let i = 0; i < hashes.length; i += 500) {
        const blobs = await db.selectFrom("inspect_blob").select(["hash", "content"])
          .where("session_id", "=", sessionId).where("hash", "in", hashes.slice(i, i + 500)).execute();
        for (const b of blobs) content.set(b.hash, b.content);
      }
      let tools: unknown = [];
      try { tools = JSON.parse(content.get(req.toolsHash) ?? "[]"); } catch { /* keep [] */ }
      return {
        id: row.id, round: row.round, createdAt: row.created_at, tools,
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.hash == null ? null : (content.get(m.hash) ?? "(expired)"),
          ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
          ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        })),
      };
    },

    async getSetting(workspaceId, key) {
      const r = await db.selectFrom("workspace_setting").selectAll().where("workspace_id", "=", workspaceId).where("key", "=", key).executeTakeFirst();
      return r ? { value: r.value, updatedAt: r.updated_at } : undefined;
    },

    async setSetting(workspaceId, key, value) {
      const updated_at = now();
      await db
        .insertInto("workspace_setting")
        .values({ workspace_id: workspaceId, key, value, updated_at })
        .onConflict((oc) => oc.columns(["workspace_id", "key"]).doUpdateSet({ value, updated_at }))
        .execute();
      return { value, updatedAt: updated_at };
    },

    async listMcpServers(workspaceId) {
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).orderBy("name", "asc").execute();
    },

    async getMcpServer(workspaceId, id) {
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async createMcpServer(input) {
      const row: McpServerRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        name: input.name,
        url: input.url,
        transport: input.transport,
        headers_json: JSON.stringify(input.headers),
        enabled: input.enabled ? 1 : 0,
        scope_mode: input.scope.mode,
        scope_all: input.scope.all || input.scope.mode === "global" ? 1 : 0,
        scope_ids_json: JSON.stringify(input.scope.all ? [] : input.scope.ids),
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("mcp_server").values(row).execute();
      return row;
    },

    async updateMcpServer(workspaceId, id, p) {
      const set: Record<string, string | number> = { updated_at: now() };
      if (p.name !== undefined) set.name = p.name;
      if (p.url !== undefined) set.url = p.url;
      if (p.transport !== undefined) set.transport = p.transport;
      if (p.headers !== undefined) set.headers_json = JSON.stringify(p.headers);
      if (p.enabled !== undefined) set.enabled = p.enabled ? 1 : 0;
      if (p.scope) {
        set.scope_mode = p.scope.mode;
        set.scope_all = p.scope.all || p.scope.mode === "global" ? 1 : 0;
        set.scope_ids_json = JSON.stringify(p.scope.all ? [] : p.scope.ids);
      }
      await db.updateTable("mcp_server").set(set).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      return db.selectFrom("mcp_server").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async deleteMcpServer(workspaceId, id) {
      const rows = await db.deleteFrom("mcp_server").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      return Number(res?.numDeletedRows ?? 0) > 0;
    },

    async listMemories(workspaceId, owners) {
      return db
        .selectFrom("memory")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where((eb) =>
          eb.or([
            eb("level", "=", "organization"),
            ...(owners.directoryId ? [eb.and([eb("level", "=", "code_directory"), eb("directory_id", "=", owners.directoryId)])] : []),
            ...(owners.agentId ? [eb.and([eb("level", "=", "self"), eb("agent_id", "=", owners.agentId)])] : []),
            ...(owners.sessionId ? [eb.and([eb("level", "=", "session"), eb("session_id", "=", owners.sessionId)])] : []),
          ]),
        )
        .orderBy("created_at", "asc")
        .execute();
    },

    async listAllMemories(workspaceId) {
      return db.selectFrom("memory").selectAll().where("workspace_id", "=", workspaceId).orderBy("created_at", "asc").execute();
    },

    async getMemory(workspaceId, id) {
      return db.selectFrom("memory").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async createMemory(input) {
      const row: MemoryRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        level: input.level,
        directory_id: input.level === "code_directory" ? (input.directoryId ?? null) : null,
        agent_id: input.level === "self" ? (input.agentId ?? null) : null,
        session_id: input.level === "session" ? (input.sessionId ?? null) : null,
        title: input.title,
        content: input.content,
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("memory").values(row).execute();
      return row;
    },

    async updateMemory(workspaceId, id, patchBody) {
      await db.updateTable("memory").set({ ...patchBody, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      return db.selectFrom("memory").selectAll().where("workspace_id", "=", workspaceId).where("id", "=", id).executeTakeFirst();
    },

    async deleteMemory(workspaceId, id) {
      const rows = await db.deleteFrom("memory").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      return Number(res?.numDeletedRows ?? 0) > 0;
    },

    async purgeInspection(before) {
      const r = await db.deleteFrom("inspect_round").where("created_at", "<", before).executeTakeFirst();
      const b = await db.deleteFrom("inspect_blob").where("last_used_at", "<", before).executeTakeFirst();
      return { rounds: Number(r.numDeletedRows ?? 0), blobs: Number(b.numDeletedRows ?? 0) };
    },

    async deleteCheckpoint(workspaceId, id) {
      const rows = await db.deleteFrom("checkpoint").where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
      const res = Array.isArray(rows) ? rows[0] : rows;
      return Number(res?.numDeletedRows ?? 0) > 0;
    },

    async incrementUsage(sessionId, add) {
      const ts = now();
      await db.insertInto("session_usage").values({
        session_id: sessionId,
        input_tokens: add.inputTokens,
        output_tokens: add.outputTokens,
        cached_tokens: add.cachedTokens,
        calls: 1,
        cost_usd: add.costUsd,
        updated_at: ts,
      })
        .onConflict((oc) => oc.column("session_id").doUpdateSet({
          input_tokens: sql`${sql.ref("session_usage")}.${sql.ref("input_tokens")} + ${add.inputTokens}`,
          output_tokens: sql`${sql.ref("session_usage")}.${sql.ref("output_tokens")} + ${add.outputTokens}`,
          cached_tokens: sql`${sql.ref("session_usage")}.${sql.ref("cached_tokens")} + ${add.cachedTokens}`,
          calls: sql`${sql.ref("session_usage")}.${sql.ref("calls")} + 1`,
          cost_usd: add.costUsd === null ? sql`${sql.ref("session_usage")}.${sql.ref("cost_usd")}`
            : sql`coalesce(${sql.ref("session_usage")}.${sql.ref("cost_usd")}, 0) + ${add.costUsd}`,
          updated_at: ts,
        }))
        .execute();
    },

    async getUsage(sessionId) {
      return db.selectFrom("session_usage").selectAll().where("session_id", "=", sessionId).executeTakeFirst();
    },
  };
}

export { parseJson };
