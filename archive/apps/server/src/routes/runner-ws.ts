import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import { runnerManager } from "../lib/runner-manager";
import { ingestRunnerMetrics, type RunnerMetricsPayload } from "../lib/runner-metrics";
import { logger } from "../lib/logger";
import { notify } from "../lib/notifications/notify";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface WsMessage {
  type: string;
  runnerId?: string;
  sessionId?: string;
  cols?: number;
  rows?: number;
  data?: string;
  code?: number;
  cwd?: string;
  tmuxName?: string;
  /** metrics stream (10s cadence). */
  metrics?: RunnerMetricsPayload;
  /** Teams bridge (runner→server). */
  teamsAccountId?: string;
  status?: string;
  error?: string;
  event?: import("@twodb/runner-core").TeamsEvent;
  viewId?: string;
  dataBase64?: string;
}

function parseMessage(data: unknown): WsMessage | null {
  try {
    return JSON.parse(String(data)) as WsMessage;
  } catch {
    return null;
  }
}

export function registerRunnerWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  // Runner agents connect here with an access key.
  app.get(
    "/api/runners/connect",
    upgradeWebSocket((c: Context) => {
      const key = c.req.query("key") ?? "";
      const name = c.req.query("name") || "runner";
      const hostname = c.req.query("hostname") || null;
      let runnerId: string | null = null;

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const keyRow = await db.selectFrom("runner_access_key").selectAll().where("key", "=", key).executeTakeFirst();

          if (!keyRow || keyRow.revokedAt) {
            logger.warn({ name }, "runner connect rejected: invalid or revoked key");
            ws.close(4403, "invalid or revoked key");
            return;
          }

          const now = new Date();
          let runner = await db
            .selectFrom("runner")
            .selectAll()
            .where("accessKeyId", "=", keyRow.id)
            .where("name", "=", name)
            .where("deletedAt", "is", null)
            .executeTakeFirst();

          if (runner) {
            await db.updateTable("runner").set({ lastSeenAt: now, hostname }).where("id", "=", runner.id).execute();
          } else {
            runner = await db
              .insertInto("runner")
              .values({
                id: crypto.randomUUID(),
                organizationId: keyRow.organizationId,
                accessKeyId: keyRow.id,
                name,
                hostname,
                lastSeenAt: now,
                createdAt: now,
                deletedAt: null,
              })
              .returningAll()
              .executeTakeFirstOrThrow();
          }

          runnerId = runner.id;
          runnerManager.addRunner({
            runnerId: runner.id,
            organizationId: keyRow.organizationId,
            name,
            ws,
          });
          logger.info({ runnerId: runner.id, organizationId: keyRow.organizationId, name, hostname }, "runner connected");
          void notify({ organizationId: keyRow.organizationId, type: "core.runner", audience: { kind: "org" }, title: `Runner connected`, body: name ? `${name} is online` : "A runner just connected", urgency: "low", silent: true, dedupeKey: `core.runner.up:${runner.id}`, data: { runnerId: runner.id, state: "online" } }).catch(() => {});
          ws.send(JSON.stringify({ type: "welcome", runnerId: runner.id }));
          // Push the disk-path config so the first metrics sample covers it.
          if (runner.diskPaths?.length) ws.send(JSON.stringify({ type: "metricsConfig", diskPaths: runner.diskPaths }));
        },

        onMessage(evt: { data: unknown }, ws: WSContext) {
          if (!runnerId) return;
          const msg = parseMessage(evt.data);
          if (!msg) return;
          // App-level keepalive — the runner pings every 5s and force-reconnects
          // when a pong doesn't arrive, catching half-open TCP faster than the
          // 30s protocol-level heartbeat.
          if (msg.type === "ping") {
            try {
              ws.send(JSON.stringify({ type: "pong" }));
            } catch {
              // socket gone; onClose cleans up
            }
            return;
          }
          // Metrics ride the control socket — ingest before the general routing.
          if (msg.type === "metrics" && msg.metrics) {
            ingestRunnerMetrics(runnerId, runnerManager.orgOf(runnerId) ?? "", msg.metrics);
            return;
          }
          if (msg.type?.startsWith("teams")) {
            void import("../lib/teams/manager").then((m) => m.handleTeamsRunnerMessage(runnerId!, msg));
            return;
          }
          runnerManager.fromRunner(runnerId, msg);
        },

        async onClose() {
          if (!runnerId) return;
          logger.info({ runnerId }, "runner disconnected");
          const orgId = runnerManager.orgOf(runnerId);
          const runnerName = (await db.selectFrom("runner").select("name").where("id", "=", runnerId).executeTakeFirst())?.name ?? null;
          runnerManager.removeRunner(runnerId);
          await db.updateTable("runner").set({ lastSeenAt: new Date() }).where("id", "=", runnerId).execute();
          if (orgId) {
            void notify({ organizationId: orgId, type: "core.runner", audience: { kind: "org" }, title: `Runner disconnected`, body: runnerName ? `${runnerName} went offline` : "A runner went offline", urgency: "critical", dedupeKey: `core.runner.down:${runnerId}`, renotifyOnDedupe: true, data: { runnerId, state: "offline" } }).catch(() => {});
          }
        },
      };
    }),
  );

  // Browser terminals connect here with a session cookie.
  app.get(
    "/api/terminal",
    upgradeWebSocket((c: Context) => {
      const headers = c.req.raw.headers;
      const sessionReady = auth.api
        .getSession({ headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);
      let sessionId: string | null = null;

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          if (!(await sessionReady)) ws.close(4401, "unauthorized");
        },

        async onMessage(evt: { data: unknown }, ws: WSContext) {
          const organizationId = await sessionReady;
          if (!organizationId) return;
          const msg = parseMessage(evt.data);
          if (!msg) return;

          if (msg.type === "open" && msg.runnerId && !sessionId) {
            const runner = await db
              .selectFrom("runner")
              .select("id")
              .where("id", "=", msg.runnerId)
              .where("organizationId", "=", organizationId)
              .where("deletedAt", "is", null)
              .executeTakeFirst();

            const newSessionId = crypto.randomUUID();
            if (!runner || !runnerManager.openTerminal(newSessionId, msg.runnerId, ws)) {
              ws.send(JSON.stringify({ type: "error", message: "runner offline" }));
              return;
            }
            sessionId = newSessionId;
            runnerManager.toRunner(sessionId, {
              type: "open",
              sessionId,
              cols: msg.cols ?? 80,
              rows: msg.rows ?? 24,
              cwd: typeof msg.cwd === "string" && msg.cwd ? msg.cwd : undefined,
              tmuxName: typeof msg.tmuxName === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(msg.tmuxName) ? msg.tmuxName : undefined,
            });
            return;
          }

          if (!sessionId) return;
          if (msg.type === "input") {
            runnerManager.toRunner(sessionId, {
              type: "input",
              sessionId,
              data: msg.data,
            });
          } else if (msg.type === "resize") {
            runnerManager.toRunner(sessionId, {
              type: "resize",
              sessionId,
              cols: msg.cols,
              rows: msg.rows,
            });
          }
        },

        onClose(_evt: unknown, ws: WSContext) {
          runnerManager.detachClient(ws);
        },
      };
    }),
  );
}
