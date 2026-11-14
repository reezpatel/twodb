import type { Kysely } from "kysely";
import { sql } from "kysely";
import { ulid } from "ulid";
import type { AgentRow, ArtisanDb, CheckpointRow, DirectoryRow, MessageRow, SessionRow, SessionUsageRow, SkillRow, ThreadRow } from "./schema.js";

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
  listSessions(workspaceId: string, filter?: { type?: string; runner?: string; directory?: string; spaceId?: string; parentSessionId?: string }): Promise<SessionRow[]>;
  /** Unfiltered (every type) — admin/parent views. */
  listSessionsAll(workspaceId: string, parentSessionId?: string): Promise<SessionRow[]>;
  touchSession(id: string): Promise<void>;
  renameSession(workspaceId: string, id: string, title: string): Promise<void>;
  setSessionThinkingLevel(workspaceId: string, id: string, level: string | null): Promise<void>;
  setSessionModel(workspaceId: string, id: string, model: string): Promise<void>;
  setSessionPlan(id: string, plan: Array<{ description: string; status: string }> | null): Promise<void>;

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
    workspaceId: string; spaceId: string; type: string; name: string; description?: string;
    instruction: string; model?: string | null; tools?: string[]; skillTags?: string[];
    tags?: string[]; runner?: string | null; directory?: string | null;
  }): Promise<AgentRow>;
  getAgent(workspaceId: string, id: string): Promise<AgentRow | undefined>;
  listAgents(workspaceId: string, spaceId?: string): Promise<AgentRow[]>;
  /** Directory agent config for (runner, directory) — auto-created on first use. */
  getOrCreateDirectoryAgent(workspaceId: string, spaceId: string, runner: string, directory: string): Promise<AgentRow>;
  updateAgent(workspaceId: string, id: string, patch: Partial<{
    name: string; description: string; instruction: string; model: string | null;
    tools: string[]; skillTags: string[]; tags: string[]; runner: string | null; directory: string | null;
  }>): Promise<AgentRow | undefined>;
  deleteAgent(workspaceId: string, id: string): Promise<boolean>;

  // skills
  createSkill(input: {
    workspaceId: string; spaceId: string; directory?: string | null; name: string;
    description: string; content: string; tags?: string[];
  }): Promise<SkillRow>;
  listSkills(workspaceId: string, spaceId: string): Promise<SkillRow[]>;
  updateSkill(workspaceId: string, id: string, patch: Partial<{
    name: string; description: string; content: string; directory: string | null; tags: string[];
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
        thinking_level: null,
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
      else q = q.where("type", "=", "directory");
      if (filter?.runner) q = q.where("runner", "=", filter.runner);
      if (filter?.directory) q = q.where("directory", "=", filter.directory);
      if (filter?.spaceId) q = q.where("space_id", "=", filter.spaceId);
      if (filter?.parentSessionId) q = q.where("parent_session_id", "=", filter.parentSessionId);
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

    async setSessionModel(workspaceId, id, model) {
      await db.updateTable("session").set({ model, updated_at: now() }).where("workspace_id", "=", workspaceId).where("id", "=", id).execute();
    },

    async setSessionPlan(id, plan) {
      await db.updateTable("session").set({ plan_json: plan ? JSON.stringify(plan) : null, updated_at: now() }).where("id", "=", id).execute();
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
      const cnt = await db.selectFrom("message").select((eb) => eb.fn.countAll<number>().as("n"))
        .where("thread_id", "=", input.threadId).executeTakeFirst();
      const row: MessageRow = {
        id: newId(),
        thread_id: input.threadId,
        session_id: input.sessionId,
        idx: Number(cnt?.n ?? 0),
        role: input.role,
        content: input.content,
        meta_json: JSON.stringify(input.meta ?? {}),
        created_at: now(),
      };
      await db.insertInto("message").values(row).execute();
      return row;
    },

    async listThreadMessages(threadId) {
      return db.selectFrom("message").selectAll().where("thread_id", "=", threadId).orderBy("idx", "asc").execute();
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
        space_id: input.spaceId,
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
      if (spaceId) q = q.where("space_id", "=", spaceId);
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
      return Number(res?.numDeletedRows ?? 0) > 0;
    },

    async createSkill(input) {
      const row: SkillRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        directory: input.directory ?? null,
        name: input.name,
        description: input.description,
        content: input.content,
        tags_json: JSON.stringify(input.tags ?? ["default"]),
        created_at: now(),
        updated_at: now(),
      };
      await db.insertInto("skill").values(row).execute();
      return row;
    },

    async listSkills(workspaceId, spaceId) {
      return db.selectFrom("skill").selectAll()
        .where("workspace_id", "=", workspaceId).where("space_id", "=", spaceId)
        .orderBy("name", "asc").execute();
    },

    async updateSkill(workspaceId, id, patch) {
      const set: Record<string, string | null> = { updated_at: now() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.content !== undefined) set.content = patch.content;
      if (patch.directory !== undefined) set.directory = patch.directory;
      if (patch.tags !== undefined) set.tags_json = JSON.stringify(patch.tags);
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
      return Number(res?.numDeletedRows ?? 0) > 0;
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
