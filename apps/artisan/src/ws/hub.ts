import type { WebSocket } from "ws";

/**
 * Workspace WS hub: one connection per workspace, session rooms multiplexed
 * over it. Every frame is tagged with sessionId; viewer input (send, ask_user
 * answers, commands) rides the same socket. A session run fans out to every
 * socket in its room.
 */

export type ClientFrame =
  | { type: "join"; sessionId: string }
  | { type: "leave"; sessionId: string }
  | { type: "send"; sessionId: string; text: string }
  | { type: "answer"; sessionId: string; askId: string; answers: Array<string | string[]> }
  | { type: "cancel"; sessionId: string; askId: string }
  | { type: "typing"; sessionId: string };

/** Frames the server pushes to clients, all tagged with sessionId. */
export type ServerFrameBody =
  | { type: "joined"; title: string }
  | { type: "left" }
  | { type: "message"; message: { id: string; role: string; content: string; meta: unknown; createdAt: string } }
  | { type: "run_start" }
  | { type: "round_start"; round: number }
  | { type: "thinking_delta"; text: string }
  | { type: "delta"; messageId: string; text: string }
  | { type: "message_done"; messageId: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_output"; id: string; stream: "stdout" | "stderr"; data: string }
  | { type: "tool_result"; id: string; name: string; output: string; ok: boolean }
  | { type: "ask_user"; askId: string; questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }> }
  | { type: "ask_resolved" }
  | { type: "status"; text: string }
  | { type: "plan"; plan: Array<{ description: string; status: string }> | null }
  | { type: "usage"; usage: { inputTokens: number; outputTokens: number; cachedTokens: number; calls: number; costUsd: number | null } }
  | { type: "compaction_done"; summary: string }
  | { type: "new_thread" }
  | { type: "session_renamed"; title: string }
  | { type: "error"; message: string }
  | { type: "done"; ok: boolean; message: string };

export type ServerFrame = { sessionId: string } & ServerFrameBody;

interface Room {
  sockets: Set<WebSocket>;
}

export class WorkspaceHub {
  /** workspaceId → sessionId → sockets */
  private rooms = new Map<string, Map<string, Room>>();

  join(workspaceId: string, sessionId: string, socket: WebSocket): void {
    let ws = this.rooms.get(workspaceId);
    if (!ws) {
      ws = new Map();
      this.rooms.set(workspaceId, ws);
    }
    let room = ws.get(sessionId);
    if (!room) {
      room = { sockets: new Set() };
      ws.set(sessionId, room);
    }
    room.sockets.add(socket);
  }

  leave(workspaceId: string, sessionId: string, socket: WebSocket): void {
    const room = this.rooms.get(workspaceId)?.get(sessionId);
    if (!room) return;
    room.sockets.delete(socket);
    if (room.sockets.size === 0) this.rooms.get(workspaceId)!.delete(sessionId);
  }

  dropSocket(workspaceId: string, socket: WebSocket): void {
    const ws = this.rooms.get(workspaceId);
    if (!ws) return;
    for (const [sessionId, room] of ws) {
      room.sockets.delete(socket);
      if (room.sockets.size === 0) ws.delete(sessionId);
    }
  }

  /** Fan a frame out to every socket in a session's room. */
  broadcast(workspaceId: string, sessionId: string, frame: ServerFrameBody): void {
    const room = this.rooms.get(workspaceId)?.get(sessionId);
    if (!room) return;
    const payload = JSON.stringify({ sessionId, ...frame });
    for (const socket of room.sockets) {
      if (socket.readyState === socket.OPEN) socket.send(payload);
    }
  }

  roomSize(workspaceId: string, sessionId: string): number {
    return this.rooms.get(workspaceId)?.get(sessionId)?.sockets.size ?? 0;
  }
}
