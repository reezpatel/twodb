import os from "node:os";
import { db } from "../auth";
import { logger } from "./logger";
import { runnerManager } from "./runner-manager";
import { ingestRunnerMetrics } from "./runner-metrics";
import { RunnerCore, collectMetrics, awsStatus, awsLogin, awsSelectProfile } from "@twodb/runner-core";

/**
 * Embedded runner: the main app acts as a runner for its own machine — no
 * websocket, no access key. Runs in-process using runner-core.
 *
 * Wiring: the core registers with the runner manager like a socket runner,
 * with a virtual sink as its "ws" — server→runner messages (exec, spawnJob,
 * jobOutput, jobKill) flow manager → sink → core.handle, and runner→server
 * messages flow core.send → manager.fromRunner. Everything that works over
 * the ws protocol (background jobs, execs) works locally for free.
 *
 * One machine = one runner: registered under the org's "local" runner row.
 */

const RUNNER_NAME = "local";

let core: RunnerCore | null = null;
let localId: string | null = null;
let orgId: string | null = null;
let metricsTimer: ReturnType<typeof setInterval> | null = null;
let diskPaths: string[] = ["/"];

export function localRunnerId(): string | null {
  return localId;
}

/** Virtual ws sink — only send/close are ever used by the manager. */
const localSink = {
  send: (data: string) => {
    try {
      const msg = JSON.parse(data) as { type: string; requestId?: string };
      // AWS bridge — handled here, replies route back through the manager.
      switch (msg.type) {
        case "awsStatus":
          void awsStatus().then((status) => runnerManager.fromRunner(localId!, { type: "awsStatusResult", requestId: msg.requestId, ...({ status } as object) } as never));
          break;
        case "awsLogin":
          void awsLogin({}, (start) => {
            runnerManager.fromRunner(localId!, {
              type: "awsLoginCode",
              requestId: msg.requestId,
              userCode: start.userCode,
              verificationUri: start.verificationUri,
              verificationUriComplete: start.verificationUriComplete,
              expiresInSeconds: start.expiresInSeconds,
            } as never);
          }, (ok, error) => {
            runnerManager.fromRunner(localId!, { type: "awsLoginResult", requestId: msg.requestId, ok, ...(error ? { error } : {}) } as never);
          });
          break;
        case "awsSelect":
          void awsSelectProfile((msg as unknown as { profile?: string }).profile ?? "").then((r) =>
            runnerManager.fromRunner(localId!, { type: "awsSelectResult", requestId: msg.requestId, ...r } as never),
          );
          break;
        case "teamsStart":
          // Teams bridge needs Chromium — standalone runners only.
          runnerManager.fromRunner(localId!, {
            type: "teamsStatus",
            teamsAccountId: (msg as unknown as { teamsAccount?: { id: string } }).teamsAccount?.id,
            status: "error",
            error: "The embedded local runner can't host Teams browser sessions — pick a standalone runner in Settings → Teams.",
          } as never);
          break;
        default:
          core?.handle(msg as Parameters<RunnerCore["handle"]>[0]);
      }
    } catch {
      // ignore malformed
    }
  },
  close: () => {},
};

/** Boot the embedded runner for the org. Idempotent per process. */
export async function startLocalRunner(organizationId: string) {
  if (localId) return;

  const now = new Date();
  // The local runner needs a key row to satisfy the FK; it's never used for
  // connections (nothing can authenticate with it — it's revoked on purpose).
  let keyRow = await db
    .selectFrom("runner_access_key")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("name", "=", "local (embedded)")
    .executeTakeFirst();
  if (!keyRow) {
    keyRow = await db
      .insertInto("runner_access_key")
      .values({
        id: crypto.randomUUID(),
        organizationId,
        name: "local (embedded)",
        key: `twr_local_${crypto.randomUUID().replaceAll("-", "")}`,
        createdAt: now,
        revokedAt: now,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
  }

  let runner = await db
    .selectFrom("runner")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("name", "=", RUNNER_NAME)
    .where("deletedAt", "is", null)
    .executeTakeFirst();

  if (!runner) {
    runner = await db
      .insertInto("runner")
      .values({
        id: crypto.randomUUID(),
        organizationId,
        accessKeyId: keyRow.id,
        name: RUNNER_NAME,
        hostname: os.hostname(),
        diskPaths: JSON.stringify(["/"]),
        lastSeenAt: now,
        createdAt: now,
        deletedAt: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } else {
    await db.updateTable("runner").set({ lastSeenAt: now, hostname: os.hostname() }).where("id", "=", runner.id).execute();
  }

  localId = runner.id;
  orgId = organizationId;
  diskPaths = runner.diskPaths ?? ["/"];

  core = new RunnerCore({
    send: (msg) => {
      // Runner→server messages enter the manager exactly like socket frames;
      // exec/job protocols resolve through it. Metrics are collected by the
      // local tick below, never routed through the core.
      if (localId) runnerManager.fromRunner(localId, msg as { type: string; sessionId?: string; execId?: string });
    },
    ptySpawn: null, // main app: terminals only on real runners
  });

  runnerManager.addRunner({ runnerId: localId, organizationId, name: RUNNER_NAME, ws: localSink as never });

  const tick = () => {
    const id = localId;
    const org = orgId;
    if (!id || !org) return;
    collectMetrics(diskPaths, (m) => ingestRunnerMetrics(id, org, m));
  };
  tick();
  metricsTimer = setInterval(tick, 10_000);

  logger.info({ runnerId: localId, organizationId }, "embedded local runner started");
}

/** Update disk paths (Settings → Runners configures the local runner too). */
export function setLocalDiskPaths(paths: string[]) {
  diskPaths = paths.length ? paths : ["/"];
}

/** Heartbeat the DB row so the local runner never looks stale. */
export function touchLocalRunner() {
  if (!localId) return;
  void db.updateTable("runner").set({ lastSeenAt: new Date() }).where("id", "=", localId).execute().catch(() => {});
}

export function stopLocalRunner() {
  if (metricsTimer) clearInterval(metricsTimer);
  metricsTimer = null;
  core = null;
  if (localId) {
    runnerManager.removeRunner(localId);
    localId = null;
  }
}
