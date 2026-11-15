import type { Kysely } from "kysely";
import { ulid } from "ulid";
import type { TwoChatDb } from "../db/schema.js";
import type { CollabRunRow, CollabTaskRow } from "./schema.js";
import { RUNTIME_APP } from "./types.js";

const iso = () => new Date().toISOString();

/** Plain queries over the collab tables. No messaging, no side effects beyond the rows. */
export function createCollabStore(db: Kysely<TwoChatDb>) {
  return {
    getTask: (id: string) => db.selectFrom("collab_task").selectAll().where("id", "=", id).executeTakeFirst(),
    getRun: (id: string) => db.selectFrom("collab_run").selectAll().where("id", "=", id).executeTakeFirst(),

    openTask: (channelId: string, botId: string) =>
      db.selectFrom("collab_task").selectAll().where("channel_id", "=", channelId).where("bot_id", "=", botId).where("status", "=", "open").orderBy("created_at", "desc").limit(1).executeTakeFirst(),

    /** Note of the latest finished task of this pair — what a new task's session is seeded with. */
    async lastWorkNote(channelId: string, botId: string): Promise<string | null> {
      const r = await db.selectFrom("collab_task").select("work_note").where("channel_id", "=", channelId).where("bot_id", "=", botId).where("status", "=", "completed").where("work_note", "is not", null).orderBy("updated_at", "desc").limit(1).executeTakeFirst();
      return r?.work_note ?? null;
    },

    async createTask(input: { workspaceId: string; channelId: string; botId: string; epoch?: number }): Promise<CollabTaskRow> {
      const row: CollabTaskRow = {
        id: ulid(), workspace_id: input.workspaceId, channel_id: input.channelId, bot_id: input.botId, status: "open",
        epoch: input.epoch ?? 0, session_id: null, work_note: null, last_activity_at: iso(), created_at: iso(), updated_at: iso(),
      };
      await db.insertInto("collab_task").values(row).execute();
      return row;
    },

    async patchTask(id: string, patch: Partial<Pick<CollabTaskRow, "status" | "epoch" | "session_id" | "work_note">> & { touch?: boolean }): Promise<void> {
      const { touch, ...rest } = patch;
      await db.updateTable("collab_task").set({ ...rest, ...(touch ? { last_activity_at: iso() } : {}), updated_at: iso() } as never).where("id", "=", id).execute();
    },

    async insertRun(row: Omit<CollabRunRow, "created_at" | "finished_at" | "reply_message_id"> & { created_at?: string }): Promise<CollabRunRow> {
      const full: CollabRunRow = { ...row, reply_message_id: null, created_at: row.created_at ?? iso(), finished_at: null };
      await db.insertInto("collab_run").values(full).execute();
      return full;
    },

    async patchRun(id: string, patch: Partial<Pick<CollabRunRow, "state" | "reply_message_id" | "finished_at">>): Promise<void> {
      await db.updateTable("collab_run").set(patch as never).where("id", "=", id).execute();
    },

    /** Runs of a task, newest first, excluding rolled-back ones. */
    liveRuns: (taskId: string) => db.selectFrom("collab_run").selectAll().where("task_id", "=", taskId).where("state", "!=", "rolled_back").orderBy("id", "desc").execute(),

    activeRunsInChannel: (channelId: string) =>
      db.selectFrom("collab_run").selectAll().where("channel_id", "=", channelId).where("state", "in", ["queued", "running"]).execute(),

    /** Runs (any state but rolled back) whose trigger message is at or after `fromIso`, with the task they belong to. */
    runsTriggeredFrom: (channelId: string, fromIso: string) =>
      db.selectFrom("collab_run").innerJoin("message", "message.id", "collab_run.trigger_message_id")
        .selectAll("collab_run").where("collab_run.channel_id", "=", channelId).where("collab_run.state", "!=", "rolled_back")
        .where("message.created_at", ">=", fromIso).orderBy("collab_run.id", "asc").execute(),

    tasksInChannel: (channelId: string) => db.selectFrom("collab_task").selectAll().where("channel_id", "=", channelId).execute(),

    /** Bots backed by Artisan collaborators. */
    runtimeBots: (workspaceId: string, botIds?: string[]) => {
      let q = db.selectFrom("bot").selectAll().where("workspace_id", "=", workspaceId).where("runtime_app", "=", RUNTIME_APP);
      if (botIds) q = q.where("id", "in", botIds.length ? botIds : [""]);
      return q.execute();
    },

    async upsertRuntimeBot(workspaceId: string, ref: string, v: { name: string; description: string; enabled: boolean }): Promise<string> {
      const existing = await db.selectFrom("bot").select("id").where("workspace_id", "=", workspaceId).where("runtime_app", "=", RUNTIME_APP).where("runtime_ref", "=", ref).executeTakeFirst();
      if (existing) {
        await db.updateTable("bot").set({ name: v.name, description: v.description, enabled: v.enabled }).where("id", "=", existing.id).execute();
        return existing.id;
      }
      const id = ulid();
      await db.insertInto("bot").values({
        id, workspace_id: workspaceId, name: v.name, kind: "collaborator", api_key_id: null, avatar_emoji: "🤖",
        description: v.description, runtime_app: RUNTIME_APP, runtime_ref: ref, enabled: v.enabled, created_at: iso(),
      }).execute();
      return id;
    },

    /** Idle sweep: tasks nobody touched for `ms` are closed. Returns how many. */
    async closeIdleTasks(ms: number): Promise<number> {
      const res = await db.updateTable("collab_task").set({ status: "completed", updated_at: iso() }).where("status", "=", "open").where("last_activity_at", "<", new Date(Date.now() - ms).toISOString()).executeTakeFirst();
      return Number(res.numUpdatedRows ?? 0);
    },

    overdueRuns: (graceMs: number) =>
      db.selectFrom("collab_run").selectAll().where("state", "in", ["queued", "running"]).where("deadline_at", "<", new Date(Date.now() - graceMs).toISOString()).execute(),

    /** Hide every message of a channel from `fromIso` on (rollback keeps them, flagged). Returns the ids. */
    async hideMessagesFrom(channelId: string, fromIso: string): Promise<string[]> {
      const rows = await db.updateTable("message").set({ rolled_back_at: iso() }).where("channel_id", "=", channelId).where("created_at", ">=", fromIso).where("rolled_back_at", "is", null).returning("id").execute();
      return rows.map((r) => r.id);
    },
  };
}

export type CollabStore = ReturnType<typeof createCollabStore>;
