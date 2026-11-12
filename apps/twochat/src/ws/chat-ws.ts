import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ChatRepo, Actor } from "../db/repository.js";
import { userActor } from "../db/repository.js";
import { ChatHub, type ClientFrame } from "./hub.js";
import { readForwardedContext } from "../gateway-context.js";

/**
 * Workspace WS: /ws. The Gateway bridges upgrades here after resolving
 * identity (x-twodb-* headers arrive on the upgrade request — same contract
 * as HTTP). Client sends typing/read frames; server pushes the full event
 * stream for the workspace.
 */
export function registerWs(app: FastifyInstance, hub: ChatHub, repo: ChatRepo): void {
  app.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
    const ctx = readForwardedContext(req);
    if (!ctx || !ctx.userId) return void socket.close(4401, "no identity");
    const workspaceId = ctx.workspaceId;
    const userId: string = ctx.userId;
    const actor: Actor = userActor(userId);

    hub.add(socket, workspaceId, userId);
    socket.send(JSON.stringify({ type: "hello", userId }));

    socket.on("message", (raw: unknown) => {
      let frame: ClientFrame;
      try {
        frame = JSON.parse(String(raw)) as ClientFrame;
      } catch {
        return;
      }
      switch (frame.type) {
        case "ping":
          socket.send(JSON.stringify({ type: "presence", online: hub.onlineUsers(workspaceId) }));
          return;
        case "typing": {
          void (async () => {
            const ch = await repo.getChannel(workspaceId, frame.channelId);
            if (!ch || !(await repo.isMember(workspaceId, frame.channelId, actor))) return;
            const members = await repo.memberPayloads(workspaceId, frame.channelId);
            const recipients = members.flatMap((member) =>
              member.type === "user" && member.userId && member.userId !== userId ? [member.userId] : [],
            );
            hub.publishToUsers(workspaceId, recipients, {
              type: "typing",
              channelId: frame.channelId,
              actor: { type: "user", id: userId, name: userId },
            });
          })();
          return;
        }
        case "read": {
          const messageId = frame.messageId ?? null;
          void (async () => {
            if (!(await repo.isMember(workspaceId, frame.channelId, actor))) return;
            await repo.markRead(workspaceId, frame.channelId, userId, messageId);
            const members = await repo.memberPayloads(workspaceId, frame.channelId);
            hub.publishToUsers(
              workspaceId,
              members.flatMap((member) => (member.type === "user" && member.userId ? [member.userId] : [])),
              { type: "read", channelId: frame.channelId, userId, messageId },
            );
          })();
          return;
        }
      }
    });
  });
}
