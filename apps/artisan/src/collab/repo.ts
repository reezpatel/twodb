import type { Kysely } from "kysely";
import type { ArtisanDb } from "../db/schema.js";
import type { CollabRunRow, CollabRunState, CollabTaskRow } from "./schema.js";
import type { RunPayload } from "./types.js";

const now = () => new Date().toISOString();

export function createCollabRepo(db: Kysely<ArtisanDb>) {
  return {
    // -- tasks ---------------------------------------------------------------
    getTask(id: string): Promise<CollabTaskRow | undefined> {
      return db.selectFrom("collab_task").selectAll().where("id", "=", id).executeTakeFirst();
    },

    async upsertTask(input: { id: string; workspaceId: string; channelId: string; agentId: string; epoch: number }): Promise<CollabTaskRow> {
      const existing = await this.getTask(input.id);
      if (existing) {
        // Only ever move the epoch forward (a late, older run must not undo a rollback).
        if (input.epoch > existing.epoch) {
          await db.updateTable("collab_task").set({ epoch: input.epoch, updated_at: now() }).where("id", "=", input.id).execute();
          return { ...existing, epoch: input.epoch };
        }
        return existing;
      }
      const row: CollabTaskRow = {
        id: input.id, workspace_id: input.workspaceId, channel_id: input.channelId, agent_id: input.agentId,
        session_id: null, epoch: input.epoch, work_note: null, created_at: now(), updated_at: now(),
      };
      await db.insertInto("collab_task").values(row).onConflict((oc) => oc.column("id").doNothing()).execute();
      return (await this.getTask(input.id)) ?? row;
    },

    async patchTask(id: string, patch: Partial<Pick<CollabTaskRow, "session_id" | "work_note" | "epoch">>): Promise<void> {
      await db.updateTable("collab_task").set({ ...patch, updated_at: now() }).where("id", "=", id).execute();
    },

    // -- runs ----------------------------------------------------------------
    /** Idempotent on run_id: a redelivered run changes nothing. */
    async insertRun(p: RunPayload): Promise<void> {
      const row: CollabRunRow = {
        run_id: p.runId, task_id: p.taskId, workspace_id: p.workspaceId, agent_id: p.agentId, channel_id: p.channelId,
        epoch: p.epoch, state: "queued", session_id: null, thread_id: null, start_idx: null,
        checkpoint_ref: null, checkpoint_sha: null, payload_json: JSON.stringify(p), trigger_message_id: p.trigger.messageId,
        replied: 0, reply_message_id: null, note: null, created_at: now(), started_at: null, finished_at: null,
      };
      await db.insertInto("collab_run").values(row).onConflict((oc) => oc.column("run_id").doNothing()).execute();
    },

    getRun(runId: string): Promise<CollabRunRow | undefined> {
      return db.selectFrom("collab_run").selectAll().where("run_id", "=", runId).executeTakeFirst();
    },

    async patchRun(runId: string, patch: Partial<Omit<CollabRunRow, "run_id">>): Promise<void> {
      await db.updateTable("collab_run").set(patch as never).where("run_id", "=", runId).execute();
    },

    /** Move a run to `to` only if it is currently in one of `from` — makes cancel/start races safe. Returns whether it moved. */
    async transitionRun(runId: string, from: CollabRunState[], to: CollabRunState, extra: Partial<CollabRunRow> = {}): Promise<boolean> {
      const res = await db.updateTable("collab_run").set({ state: to, ...extra } as never).where("run_id", "=", runId).where("state", "in", from).executeTakeFirst();
      return Number(res.numUpdatedRows ?? 0) > 0;
    },

    /** Queued runs for the task newer than `runId` (ulids sort by creation time). */
    async newerQueuedRuns(taskId: string, runId: string): Promise<CollabRunRow[]> {
      return db.selectFrom("collab_run").selectAll().where("task_id", "=", taskId).where("state", "=", "queued").where("run_id", ">", runId).execute();
    },

    /** Runs folded into the next one: superseded after the task's last finished run. */
    async supersededSince(taskId: string, runId: string): Promise<CollabRunRow[]> {
      const lastDone = await db.selectFrom("collab_run").select("run_id").where("task_id", "=", taskId).where("state", "=", "done").where("run_id", "<", runId).orderBy("run_id", "desc").limit(1).executeTakeFirst();
      let q = db.selectFrom("collab_run").selectAll().where("task_id", "=", taskId).where("state", "=", "superseded").where("run_id", "<", runId);
      if (lastDone) q = q.where("run_id", ">", lastDone.run_id);
      return q.orderBy("run_id", "asc").execute();
    },

    /** Runs of the task from `fromRunId` onward (what a rollback undoes), oldest first. */
    runsFrom(taskId: string, fromRunId: string): Promise<CollabRunRow[]> {
      return db.selectFrom("collab_run").selectAll().where("task_id", "=", taskId).where("run_id", ">=", fromRunId).orderBy("run_id", "asc").execute();
    },

    /** Reply ids sent by runs of this task (edit_reply may only touch these). */
    async replyIdsForTask(taskId: string): Promise<string[]> {
      const rows = await db.selectFrom("collab_run").select("reply_message_id").where("task_id", "=", taskId).where("replied", "=", 1).execute();
      return rows.map((r) => r.reply_message_id ?? "").filter(Boolean);
    },

    /** Runs left `running` by a process that died (state is in-memory only while running). */
    staleRunning(olderThanMs: number): Promise<CollabRunRow[]> {
      return db.selectFrom("collab_run").selectAll().where("state", "=", "running").where("started_at", "<", new Date(Date.now() - olderThanMs).toISOString()).execute();
    },

    // -- session rewinding -----------------------------------------------------
    /** Highest message idx in a thread, or -1 when empty. */
    async nextMessageIdx(threadId: string): Promise<number> {
      const r = await db.selectFrom("message").select((eb) => eb.fn.max("idx").as("m")).where("thread_id", "=", threadId).executeTakeFirst();
      return r?.m === null || r?.m === undefined ? 0 : Number(r.m) + 1;
    },

    /** Delete a thread's messages with idx >= `idx` (the rewind half of rollback). */
    async deleteMessagesFrom(threadId: string, idx: number): Promise<number> {
      const res = await db.deleteFrom("message").where("thread_id", "=", threadId).where("idx", ">=", idx).executeTakeFirst();
      return Number(res.numDeletedRows ?? 0);
    },

    /** Every collaborator agent (for syncing bots to TwoChat at boot). */
    listCollaboratorAgents() {
      return db.selectFrom("agent").selectAll().where("type", "=", "collaborator").execute();
    },
  };
}

export type CollabRepo = ReturnType<typeof createCollabRepo>;
