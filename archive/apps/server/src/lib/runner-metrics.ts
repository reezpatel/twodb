import { db } from "../auth";
import { logger } from "./logger";

/**
 * Runner metrics hub.
 *
 * Runners stream a sample every 10s over their existing control socket. This
 * hub keeps the latest sample per runner in memory (live view — broadcast to
 * clients in the `resources` room), and persists one row per 10-minute window
 * per runner (upsert keyed by runnerId+window). Rows older than 30 days are
 * pruned on write, throttled to once an hour.
 */

/** Shape mirrors packages/runner-core/src/metrics.ts RunnerMetrics. */
export interface RunnerMetricsPayload {
  at: string;
  cpu: { busy: number; load1: number; cores: number; perCore: number[] };
  memory: { used: number; total: number };
  gpus: { vendor: string; index: number; name: string; utilization: number; memoryUsed: number; memoryTotal: number; temperature: number | null }[];
  disks: { path: string; used: number; total: number; inodeUsedRatio: number | null; error?: string }[];
}

export interface LiveRunnerMetrics {
  runnerId: string;
  /** Runner-side wall clock of the sample. */
  at: string;
  metrics: RunnerMetricsPayload;
}

const WINDOW_MS = 10 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

/** Latest sample per runner — the live view pushed to the resources room. */
const latest = new Map<string, LiveRunnerMetrics>();

type Listener = (update: LiveRunnerMetrics) => void;
const listeners = new Set<Listener>();

let lastPrune = 0;

/** Floor a timestamp to its 10-minute window start. */
function windowStart(at: Date) {
  return new Date(Math.floor(at.getTime() / WINDOW_MS) * WINDOW_MS);
}

export function latestMetrics(runnerId: string) {
  return latest.get(runnerId) ?? null;
}

export function allLatestMetrics(): LiveRunnerMetrics[] {
  return [...latest.values()];
}

/** Subscribe to live updates (resources room wiring). */
export function onMetrics(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Ingest one sample from a runner. */
export function ingestRunnerMetrics(runnerId: string, organizationId: string, metrics: RunnerMetricsPayload) {
  const live: LiveRunnerMetrics = { runnerId, at: metrics.at, metrics };
  latest.set(runnerId, live);
  for (const cb of listeners) {
    try {
      cb(live);
    } catch {
      // listener bug must not break ingest
    }
  }

  const at = new Date(metrics.at);
  if (Number.isNaN(at.getTime())) return;
  const win = windowStart(at);
  const id = `${runnerId}:${win.getTime()}`;
  void db
    .insertInto("runner_metric")
    .values({
      id,
      runnerId,
      organizationId,
      at: win,
      cpu: JSON.stringify(metrics.cpu),
      memory: JSON.stringify(metrics.memory),
      gpus: JSON.stringify(metrics.gpus),
      disks: JSON.stringify(metrics.disks),
    })
    .onConflict((oc) =>
      oc
        .column("id")
        .doUpdateSet({
          cpu: JSON.stringify(metrics.cpu),
          memory: JSON.stringify(metrics.memory),
          gpus: JSON.stringify(metrics.gpus),
          disks: JSON.stringify(metrics.disks),
        }),
    )
    .execute()
    .catch((e: Error) => logger.warn({ err: e, runnerId }, "runner metric persist failed"));

  const now = Date.now();
  if (now - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = now;
    void db
      .deleteFrom("runner_metric")
      .where("at", "<", new Date(now - RETENTION_MS))
      .execute()
      .catch((e) => logger.warn({ err: e }, "runner metric prune failed"));
  }
}

/** History for charts: samples within the lookback, ascending. */
export async function runnerMetricsHistory(runnerId: string, hours = 24 * 30) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db
    .selectFrom("runner_metric")
    .select(["at", "cpu", "memory", "gpus", "disks"])
    .where("runnerId", "=", runnerId)
    .where("at", ">=", since)
    .orderBy("at", "asc")
    .execute();
}

/** Drop live state when a runner is deleted. */
export function forgetRunnerMetrics(runnerId: string) {
  latest.delete(runnerId);
}
