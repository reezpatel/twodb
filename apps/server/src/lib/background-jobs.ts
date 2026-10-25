import { db } from "../auth";
import { runnerManager } from "./runner-manager";
import { broadcastToSession } from "../routes/code-ws";
import { logger } from "./logger";
import type { CodeSessionJobStatus } from "../plugins/db";

/** Background jobs for code sessions: run_background detaches a process on the
 * runner, the tool result returns a job id immediately, and completion (or
 * failure) is delivered into the thread later as a user message — visible in
 * the transcript and picked up by the next round / auto-compaction.
 *
 * State is persisted in code_session_job so the panel survives refreshes and
 * server restarts; the runner owns the process and its log file. */

/** How long after a runner reconnect before unobserved jobs are marked lost. */
const LOST_GRACE_MS = 60_000;

export interface StartedJob {
  jobId: string;
  logPath: string;
}

/** Launch a detached job on the runner and register its completion watcher. */
export async function startBackgroundJob(opts: {
  sessionId: string;
  organizationId: string;
  runnerId: string;
  command: string;
  cwd: string | null;
}): Promise<StartedJob> {
  const jobId = crypto.randomUUID();
  const { logPath } = await runnerManager.spawnJobOnRunner(opts.runnerId, jobId, opts.command, {
    cwd: opts.cwd,
    onExit: (info) => void finishJob(jobId, info.code, info.signal, info.message),
  });
  await db
    .insertInto("code_session_job")
    .values({
      id: jobId,
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      runnerId: opts.runnerId,
      command: opts.command,
      cwd: opts.cwd,
      status: "running",
      logPath,
      createdAt: new Date(),
    })
    .execute();
  await broadcastToSession(opts.sessionId, { type: "jobs", jobs: await listJobs(opts.sessionId) });
  return { jobId, logPath };
}

/** job_logs tool — lines of the job's log, straight from the runner. Pass
 * from/to (1-based, inclusive) for a range, or lines for the tail. */
export async function readJobLogs(runnerId: string, jobId: string, opts: { lines?: number; from?: number; to?: number } = {}): Promise<{ output: string; totalLines?: number } | { error: string }> {
  const result = await runnerManager.jobOutput(runnerId, jobId, opts);
  if (result.unknown) return { error: `unknown job ${jobId} on this runner (server restart or runner restart lost it)` };
  return { output: result.output || "(no output yet)", ...(result.totalLines !== undefined ? { totalLines: result.totalLines } : {}) };
}

/** kill by id, used from the panel and available to the agent. */
export async function killBackgroundJob(runnerId: string, jobId: string): Promise<string> {
  const result = await runnerManager.killJob(runnerId, jobId);
  return result.unknown ? `unknown job ${jobId} on this runner` : `kill signal sent to ${jobId}`;
}

/**
 * Kill from the UI: after signaling, write a user message saying THE USER
 * terminated the job, with its last output. The plain kill path would only
 * mark it "killed" — the agent couldn't tell a user action from an arbitrary
 * signal. Beats the exit watcher's completion message by flipping the row
 * first (finishJob only writes while status="running").
 */
export async function killBackgroundJobByUser(runnerId: string, jobId: string): Promise<string> {
  const result = await runnerManager.killJob(runnerId, jobId);
  const row = await db.selectFrom("code_session_job").selectAll().where("id", "=", jobId).executeTakeFirst();
  if (!row || row.status !== "running") return result.unknown ? `unknown job ${jobId} on this runner` : `kill signal sent to ${jobId}`;
  await db.updateTable("code_session_job").set({ status: "killed", finishedAt: new Date() }).where("id", "=", jobId).execute();
  const body = [
    `[Background job ${jobId.slice(0, 8)} terminated by the user] $ ${row.command}`,
    "The user stopped this job manually from the UI — treat it as intentionally cancelled, not a crash. Do not restart it unless asked.",
    `To inspect output, call job_logs with job_id=${jobId} (from/to line range or lines tail).`,
  ].join("\n");
  await db
    .insertInto("code_session_message")
    .values({
      id: crypto.randomUUID(),
      sessionId: row.sessionId,
      role: "user",
      content: body,
      meta: { backgroundJob: { id: jobId, status: "killed", exitCode: null }, killedByUser: true },
      createdAt: new Date(),
    })
    .execute();
  await broadcastToSession(row.sessionId, { type: "jobs", jobs: await listJobs(row.sessionId) });
  return result.unknown ? `unknown job ${jobId} on this runner` : `kill signal sent to ${jobId}`;
}

/** Exit watcher flips the DB row, pushes the panel, and delivers the outcome
 * as a user message so the thread (and the next round) sees it. Output is not
 * included — the agent pulls it with job_logs when it needs it. */
async function finishJob(jobId: string, code: number | null, signal?: string, message?: string) {
  const row = await db.selectFrom("code_session_job").selectAll().where("id", "=", jobId).executeTakeFirst();
  if (!row || row.status !== "running") return;
  const status: CodeSessionJobStatus = signal ? "killed" : message ? "failed" : code === 0 ? "done" : code === null ? "lost" : "failed";
  await db
    .updateTable("code_session_job")
    .set({ status, exitCode: code, finishedAt: new Date() })
    .where("id", "=", jobId)
    .execute();

  const header = `[Background job ${jobId.slice(0, 8)} ${status}${code !== null ? ` (exit ${code})` : ""}${signal ? ` (signal ${signal})` : ""}] $ ${row.command}`;
  const body = [header, ...(message ? [`error: ${message}`] : []), `To inspect output, call job_logs with job_id=${jobId} (from/to line range or lines tail).`].join("\n");
  await db
    .insertInto("code_session_message")
    .values({
      id: crypto.randomUUID(),
      sessionId: row.sessionId,
      role: "user",
      content: body,
      meta: { backgroundJob: { id: jobId, status, exitCode: code } },
      createdAt: new Date(),
    })
    .execute();
  await broadcastToSession(row.sessionId, { type: "jobs", jobs: await listJobs(row.sessionId) });
  // New transcript row — viewers refetch; the session list gets its dot.
  await broadcastToSession(row.sessionId, { type: "session_updated" });
  // No viewer connected → persisted notification so the completion isn't missed.
  // Sessions aren't user-owned; code sessions are org-shared, so this is an
  // org-level notification (self-hosted is typically single-org anyway).
  const { viewersOfSession } = await import("../routes/code-ws");
  if (!viewersOfSession(row.sessionId)) {
    const session = await db.selectFrom("code_session").select(["title", "organizationId"]).where("id", "=", row.sessionId).executeTakeFirst();
    if (session) {
      const { notify } = await import("./notifications/notify");
      await notify({
        organizationId: session.organizationId,
        type: "code.job",
        audience: { kind: "org" },
        title: status === "done" ? "Background job finished" : `Background job ${status}`,
        body: `$ ${row.command}${code !== null ? ` — exit ${code}` : ""}${session.title ? ` · ${session.title}` : ""}`,
        urgency: status === "failed" || status === "lost" ? "high" : "normal",
        icon: "code",
        deepLink: `twodb://code/session/${row.sessionId}`,
        groupingKey: `code.job:${row.sessionId}`,
        dedupeKey: `code.job:${row.sessionId}:${jobId}`,
        data: { jobId, status, exitCode: code, sessionId: row.sessionId, command: row.command },
      }).catch(() => {});
    }
  }
  logger.info({ sessionId: row.sessionId, jobId, status, code }, "background job finished");
}

export async function listJobs(sessionId: string) {
  const rows = await db
    .selectFrom("code_session_job")
    .select(["id", "command", "status", "exitCode", "logPath", "createdAt", "finishedAt"])
    .where("sessionId", "=", sessionId)
    .orderBy("createdAt", "desc")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    command: r.command,
    status: r.status,
    exitCode: r.exitCode,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }));
}

function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** background_job_status tool — one line per job with status and duration
 * (start→now while running, start→finish otherwise). */
export async function formatJobStatuses(sessionId: string): Promise<string> {
  const rows = await db
    .selectFrom("code_session_job")
    .selectAll()
    .where("sessionId", "=", sessionId)
    .orderBy("createdAt", "asc")
    .execute();
  if (rows.length === 0) return "no background jobs in this session";
  const lines = rows.map((r) => {
    const end = r.finishedAt ?? new Date();
    const duration = humanDuration(Math.max(0, end.getTime() - r.createdAt.getTime()));
    // "done" is the stored status; agents read better with "completed".
    const status = r.status === "done" ? "completed" : r.status;
    return `- ${r.id} | ${status}${r.exitCode !== null ? ` | exit ${r.exitCode}` : ""} | ${duration} | $ ${r.command}`;
  });
  return `${rows.length} job(s):\n${lines.join("\n")}`;
}

/**
 * Server restart recovery: jobs stuck "running" whose runner never reported an
 * exit get marked lost after a grace period (the process may well still be
 * running on the runner — but this server no longer has a watcher). Called on
 * boot; harmless when empty.
 */
export async function reconcileOrphanJobs() {
  const stuck = await db.selectFrom("code_session_job").selectAll().where("status", "=", "running").execute();
  for (const row of stuck) {
    const ageMs = Date.now() - row.createdAt.getTime();
    if (ageMs < LOST_GRACE_MS) continue;
    await db
      .updateTable("code_session_job")
      .set({ status: "lost", finishedAt: new Date() })
      .where("id", "=", row.id)
      .where("status", "=", "running")
      .execute();
    logger.warn({ sessionId: row.sessionId, jobId: row.id }, "background job marked lost (server restarted while it ran)");
  }
}
