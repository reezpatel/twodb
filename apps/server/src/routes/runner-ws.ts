import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import { runnerManager } from "../lib/runner-manager";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface WsMessage {
  type: string;
  runnerId?: string;
  sessionId?: string;
  cols?: number;
  rows?: number;
  data?: string;
  code?: number;
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
          ws.send(JSON.stringify({ type: "welcome", runnerId: runner.id }));
        },

        onMessage(evt: { data: unknown }) {
          if (!runnerId) return;
          const msg = parseMessage(evt.data);
          if (msg) runnerManager.fromRunner(runnerId, msg);
        },

        async onClose() {
          if (!runnerId) return;
          runnerManager.removeRunner(runnerId);
          await db.updateTable("runner").set({ lastSeenAt: new Date() }).where("id", "=", runnerId).execute();
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
