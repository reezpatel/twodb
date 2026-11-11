import type { Kysely } from "kysely";
import { createHash, randomBytes } from "node:crypto";
import { ulid } from "ulid";
import type { DispatchDb, JobRow, MicrovmRow, RunnerRow } from "./schema.js";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** `twodbrun_<hex>` — distinct prefix from workspace API keys (`twodb_`) and
 *  app registration tokens (`twodbreg_`). Only the hash is stored. */
export function generateRunnerKey(): string {
  return `twodbrun_${randomBytes(24).toString("hex")}`;
}

export function newId(): string {
  return ulid().toLowerCase();
}

/** Friendly runner names: adjective-noun, workspace-unique (legacy vibe). */
const ADJECTIVES = [
  "amber", "brisk", "cobalt", "dapper", "eager", "fuzzy", "gentle", "hasty",
  "ionic", "jolly", "keen", "lively", "mellow", "nimble", "opel", "plucky",
  "quirky", "rapid", "swift", "tidy", "urban", "vivid", "wily", "zesty",
];
const NOUNS = [
  "otter", "falcon", "cedar", "harbor", "meadow", "quartz", "ripple", "summit",
  "timber", "willow", "anchor", "beacon", "canyon", "delta", "ember", "forest",
  "glacier", "hillock", "island", "juniper", "kettle", "lagoon", "marsh", "peak",
];

export function friendlyName(): string {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
}

export interface CreateRunnerInput {
  workspaceId: string;
  name?: string;
  kind?: "host" | "microvm-host";
  meta?: Record<string, unknown>;
}

export interface CreateJobInput {
  workspaceId: string;
  runnerId: string;
  resourceId: string | null;
  command: string;
}

export interface AppendJobLogInput {
  jobId: string;
  seq: number;
  stream: "stdout" | "stderr";
  line: string;
}

export function createDispatchRepo(db: Kysely<DispatchDb>) {
  // ---- runners ------------------------------------------------------------
  return {
    async createRunner(input: CreateRunnerInput): Promise<{ runner: RunnerRow; key: string }> {
      const key = generateRunnerKey();
      const row: RunnerRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        name: input.name ?? friendlyName(),
        token_hash: sha256(key),
        meta_json: JSON.stringify(input.meta ?? {}),
        kind: input.kind ?? "host",
        status: "offline",
        last_seen_at: null,
        created_at: new Date().toISOString(),
      };
      await db.insertInto("runner").values(row).execute();
      return { runner: row, key };
    },

    async listRunners(workspaceId: string): Promise<RunnerRow[]> {
      return db
        .selectFrom("runner")
        .where("workspace_id", "=", workspaceId)
        .orderBy("created_at")
        .selectAll()
        .execute();
    },

    async getRunnerByName(workspaceId: string, name: string): Promise<RunnerRow | undefined> {
      return db
        .selectFrom("runner")
        .where("workspace_id", "=", workspaceId)
        .where("name", "=", name)
        .selectAll()
        .executeTakeFirst();
    },

    async getRunnerByKey(key: string): Promise<RunnerRow | undefined> {
      return db
        .selectFrom("runner")
        .where("token_hash", "=", sha256(key))
        .selectAll()
        .executeTakeFirst();
    },

    async runnerSeen(id: string, meta: Record<string, unknown>): Promise<void> {
      await db
        .updateTable("runner")
        .set({ status: "online", last_seen_at: new Date().toISOString(), meta_json: JSON.stringify(meta) })
        .where("id", "=", id)
        .execute();
    },

    async runnerOffline(id: string): Promise<void> {
      await db
        .updateTable("runner")
        .set({ status: "offline", last_seen_at: new Date().toISOString() })
        .where("id", "=", id)
        .execute();
    },

    async deleteRunner(workspaceId: string, name: string): Promise<boolean> {
      const res = await db
        .deleteFrom("runner")
        .where("workspace_id", "=", workspaceId)
        .where("name", "=", name)
        .execute();
      return Number(res[0]?.numDeletedRows ?? 0) > 0;
    },

    async touchRunnerName(id: string, name: string): Promise<void> {
      await db.updateTable("runner").set({ name }).where("id", "=", id).execute();
    },

    async touchRunnerKind(id: string, kind: "host" | "microvm-host"): Promise<void> {
      await db.updateTable("runner").set({ kind }).where("id", "=", id).execute();
    },

    // ---- jobs ---------------------------------------------------------------
    async createJob(input: CreateJobInput): Promise<JobRow> {
      const row: JobRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        runner_id: input.runnerId,
        resource_id: input.resourceId,
        command: input.command,
        status: "running",
        exit_code: null,
        started_at: new Date().toISOString(),
        ended_at: null,
      };
      await db.insertInto("job").values(row).execute();
      return row;
    },

    async getJob(workspaceId: string, id: string): Promise<JobRow | undefined> {
      return db
        .selectFrom("job")
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .selectAll()
        .executeTakeFirst();
    },

    async listJobs(
      workspaceId: string,
      opts: { runnerId?: string; resourceId?: string; status?: string; limit?: number },
    ): Promise<JobRow[]> {
      let q = db.selectFrom("job").where("workspace_id", "=", workspaceId);
      if (opts.runnerId) q = q.where("runner_id", "=", opts.runnerId);
      if (opts.resourceId) q = q.where("resource_id", "=", opts.resourceId);
      if (opts.status) q = q.where("status", "=", opts.status as JobRow["status"]);
      return q
        .orderBy("started_at", "desc")
        .limit(opts.limit ?? 100)
        .selectAll()
        .execute();
    },

    async finishJob(id: string, status: JobRow["status"], exitCode: number | null): Promise<void> {
      await db
        .updateTable("job")
        .set({ status, exit_code: exitCode, ended_at: new Date().toISOString() })
        .where("id", "=", id)
        .execute();
    },

    // ---- job logs -------------------------------------------------------------
    async appendJobLog(input: AppendJobLogInput): Promise<void> {
      await db
        .insertInto("job_log")
        .values({
          seq: input.seq,
          job_id: input.jobId,
          stream: input.stream,
          line: input.line,
          at: new Date().toISOString(),
        })
        .execute();
    },

    async jobLogs(jobId: string, afterSeq = 0): Promise<{ seq: number; stream: string; line: string }[]> {
      const rows = await db
        .selectFrom("job_log")
        .where("job_id", "=", jobId)
        .where("seq", ">", afterSeq)
        .orderBy("seq")
        .select(["seq", "stream", "line"])
        .execute();
      return rows.map((r) => ({ seq: Number(r.seq), stream: r.stream, line: r.line }));
    },

    // ---- exec logs (streamed calls) ------------------------------------------
    async appendExecLog(input: {
      workspaceId: string;
      runnerId: string;
      resourceId: string | null;
      command: string;
      stream: "stdout" | "stderr";
      chunk: string;
    }): Promise<void> {
      await db
        .insertInto("exec_log")
        .values({
          id: newId(),
          at: new Date().toISOString(),
          workspace_id: input.workspaceId,
          runner_id: input.runnerId,
          resource_id: input.resourceId,
          command: input.command,
          stream: input.stream,
          chunk: input.chunk,
        })
        .execute();
    },

    // ---- microvms ---------------------------------------------------------------
    async getMicrovm(workspaceId: string, identifier: string): Promise<MicrovmRow | undefined> {
      return db
        .selectFrom("microvm")
        .where("workspace_id", "=", workspaceId)
        .where("identifier", "=", identifier)
        .selectAll()
        .executeTakeFirst();
    },

    async listMicrovms(workspaceId: string): Promise<MicrovmRow[]> {
      return db
        .selectFrom("microvm")
        .where("workspace_id", "=", workspaceId)
        .orderBy("created_at")
        .selectAll()
        .execute();
    },

    async createMicrovm(input: {
      workspaceId: string;
      runnerId: string;
      identifier: string;
      cid: number | null;
      meta?: Record<string, unknown>;
    }): Promise<MicrovmRow> {
      const now = new Date().toISOString();
      const row: MicrovmRow = {
        id: newId(),
        workspace_id: input.workspaceId,
        runner_id: input.runnerId,
        identifier: input.identifier,
        status: "running",
        cid: input.cid,
        boot_count: 1,
        last_active_at: now,
        created_at: now,
        archived_at: null,
        meta_json: JSON.stringify(input.meta ?? {}),
      };
      await db.insertInto("microvm").values(row).execute();
      return row;
    },

    async touchMicrovm(id: string, patch: Partial<Pick<MicrovmRow, "status" | "cid" | "boot_count" | "last_active_at" | "archived_at" | "meta_json">>): Promise<void> {
      await db.updateTable("microvm").set(patch).where("id", "=", id).execute();
    },

    async deleteMicrovm(workspaceId: string, identifier: string): Promise<boolean> {
      const res = await db
        .deleteFrom("microvm")
        .where("workspace_id", "=", workspaceId)
        .where("identifier", "=", identifier)
        .execute();
      return Number(res[0]?.numDeletedRows ?? 0) > 0;
    },
  };
}

export type DispatchRepo = ReturnType<typeof createDispatchRepo>;
