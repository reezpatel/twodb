import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth } from "../auth";
import { accountMemberIds } from "../lib/email/access";
import { logger } from "../lib/logger";

// Per-user email realtime: message created/status, thread updates, account
// sync + backfill progress. Events fan out to every member of the account.

interface EmailSocket {
  ws: WSContext;
  userId: string;
}

const sockets = new Set<EmailSocket>();

export type EmailEvent =
  | { type: "message.created"; accountId: string; threadId: string; messageId: string }
  | { type: "message.status"; accountId: string; threadId: string; messageId: string; status: string; lastError?: string | null }
  | { type: "thread.updated"; accountId: string; threadIds: string[] }
  | { type: "account.status"; accountId: string; status: string; lastError?: string | null }
  | { type: "account.backfill"; accountId: string; state: string; progress: Record<string, unknown> }
  | { type: "labels.updated" };

function sendTo(userIds: Set<string>, event: EmailEvent) {
  const data = JSON.stringify(event);
  for (const s of sockets) {
    if (!userIds.has(s.userId)) continue;
    try {
      s.ws.send(data);
    } catch {
      sockets.delete(s);
    }
  }
}

export async function broadcastEmailEvent(accountId: string, event: EmailEvent) {
  if (!sockets.size) return;
  sendTo(new Set(await accountMemberIds(accountId)), event);
}

export function broadcastEmailUserEvent(userId: string, event: EmailEvent) {
  sendTo(new Set([userId]), event);
}

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

export function registerEmailWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/email/ws",
    upgradeWebSocket((c: Context) => {
      const userReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => (s?.session.activeOrganizationId ? s.user.id : null))
        .catch(() => null);
      let socket: EmailSocket | null = null;
      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const userId = await userReady;
          if (!userId) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, userId };
          sockets.add(socket);
        },
        onClose() {
          if (socket) sockets.delete(socket);
        },
        onMessage(evt: { data: unknown }, ws: WSContext) {
          if (evt.data === '{"type":"ping"}') {
            try {
              ws.send('{"type":"pong"}');
            } catch (e) {
              logger.debug({ err: e }, "email ws pong failed");
            }
          }
        },
      };
    }),
  );
}
