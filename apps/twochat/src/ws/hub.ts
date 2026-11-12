import type { WebSocket } from "ws";

/**
 * Workspace WS hub for TwoChat. One socket per browser tab / bot client,
 * grouped by workspace. Server → client frames are the same shapes the REST
 * API returns (MessagePayload etc.) so the client has one wire format.
 *
 * Presence: any socket for a user marks them online; typing is ephemeral
 * (server echoes typing frames to the channel, client times them out).
 */

import type { MessagePayload, ReactionSummary } from "../db/repository.js";

export type ServerFrame =
  | { type: "hello"; userId: string | null }
  | { type: "message"; channelId: string; message: MessagePayload }
  | { type: "message_edited"; channelId: string; message: MessagePayload }
  | { type: "message_deleted"; channelId: string; messageId: string }
  | { type: "reaction"; channelId: string; messageId: string; reactions: ReactionSummary[] }
  | { type: "pin"; channelId: string; messageId: string; pinned: boolean }
  | { type: "typing"; channelId: string; actor: { type: "user" | "bot"; id: string; name: string } }
  | { type: "presence"; online: Array<{ type: "user" | "bot"; id: string }> }
  | { type: "read"; channelId: string; userId: string; messageId: string | null }
  | { type: "channel_created"; channel: unknown }
  | { type: "channel_updated"; channel: unknown }
  | { type: "channel_deleted"; id: string }
  | { type: "notification"; notification: unknown };

export type ClientFrame =
  | { type: "typing"; channelId: string }
  | { type: "read"; channelId: string; messageId: string | null }
  | { type: "ping" };

interface SocketEntry {
  ws: WebSocket;
  workspaceId: string;
  userId: string | null;
}

export class ChatHub {
  private sockets = new Set<SocketEntry>();

  add(ws: WebSocket, workspaceId: string, userId: string | null): void {
    const entry: SocketEntry = { ws, workspaceId, userId };
    this.sockets.add(entry);
    ws.on("close", () => {
      this.sockets.delete(entry);
      this.broadcastPresence(workspaceId);
    });
    ws.on("error", () => {
      this.sockets.delete(entry);
      this.broadcastPresence(workspaceId);
    });
    this.broadcastPresence(workspaceId);
  }

  /** Fan a frame out to every socket of a workspace. */
  publish(workspaceId: string, frame: ServerFrame): void {
    const data = JSON.stringify(frame);
    for (const s of this.sockets) {
      if (s.workspaceId !== workspaceId) continue;
      try {
        s.ws.send(data);
      } catch {
        this.sockets.delete(s);
      }
    }
  }

  /** Fan only to selected workspace users (channel/DM privacy boundary). */
  publishToUsers(workspaceId: string, userIds: Iterable<string>, frame: ServerFrame): void {
    const allowed = new Set(userIds);
    const data = JSON.stringify(frame);
    for (const s of this.sockets) {
      if (s.workspaceId !== workspaceId || !s.userId || !allowed.has(s.userId)) continue;
      try {
        s.ws.send(data);
      } catch {
        this.sockets.delete(s);
      }
    }
  }

  /** Fan out except to the sockets of one user (workspace-level presence). */
  publishExceptUser(workspaceId: string, exceptUserId: string | null, frame: ServerFrame): void {
    if (!exceptUserId) return this.publish(workspaceId, frame);
    const data = JSON.stringify(frame);
    for (const s of this.sockets) {
      if (s.workspaceId !== workspaceId || s.userId === exceptUserId) continue;
      try {
        s.ws.send(data);
      } catch {
        this.sockets.delete(s);
      }
    }
  }

  onlineUsers(workspaceId: string): Array<{ type: "user" | "bot"; id: string }> {
    const ids = new Map<string, { type: "user" | "bot"; id: string }>();
    for (const s of this.sockets) {
      if (s.workspaceId === workspaceId && s.userId) ids.set(s.userId, { type: "user", id: s.userId });
    }
    return [...ids.values()];
  }

  private broadcastPresence(workspaceId: string): void {
    this.publish(workspaceId, { type: "presence", online: this.onlineUsers(workspaceId) });
  }
}
