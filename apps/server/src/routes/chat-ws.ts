import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth } from "../auth";
import { logger } from "../lib/logger";

// Org-wide chat realtime channel: new/deleted messages, reactions, agent
// run state (typing indicator) and channel CRUD. One socket per browser tab,
// mirroring sessions-ws.

export interface ChatSocket {
  ws: WSContext;
  organizationId: string;
}

const chatSockets = new Set<ChatSocket>();

export type ChatEvent =
  | { type: "message"; channelId: string; message: unknown }
  | { type: "message_deleted"; channelId: string; messageId: string }
  | { type: "reaction"; channelId: string; messageId: string; reactions: { emoji: string; count: number; mine: boolean }[] }
  | { type: "agent_state"; channelId: string; agentId: string; state: "thinking" | "working" | "done" | "error"; detail?: string }
  | { type: "channel_created"; channel: unknown }
  | { type: "channel_updated"; channel: unknown }
  | { type: "channel_deleted"; id: string };

/** Fan a chat event out to every socket of the owning org. */
export function broadcastChatEvent(organizationId: string, event: ChatEvent) {
  const data = JSON.stringify(event);
  for (const s of chatSockets) {
    if (s.organizationId !== organizationId) continue;
    try {
      s.ws.send(data);
    } catch {
      chatSockets.delete(s);
    }
  }
}

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

export function registerChatWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/chat/ws",
    upgradeWebSocket((c: Context) => {
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);
      let socket: ChatSocket | null = null;
      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, organizationId };
          chatSockets.add(socket);
          logger.info({ organizationId }, "chat ws connected");
        },
        onClose() {
          if (socket) chatSockets.delete(socket);
          logger.info("chat ws disconnected");
        },
        async onMessage(evt: { data: unknown }, ws: WSContext) {
          const raw = typeof evt.data === "string" ? evt.data : "";
          if (raw === '{"type":"ping"}') {
            try {
              ws.send('{"type":"pong"}');
            } catch {
              // socket gone
            }
          }
        },
      };
    }),
  );
}
