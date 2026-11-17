import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ArtisanRepo } from "../db/repository.js";
import type { WorkspaceHub, ClientFrame } from "./hub.js";
import { readForwardedContext } from "../gateway-context.js";
import { resolveAsk, cancelAsk, abortSession } from "./agent-loop.js";
import type { SessionRunner } from "./session-runner.js";

/** Workspace WS: one per workspace; join/leave session rooms; viewer input.
 * All run state (queue, running, ask_user) lives in the SessionRunner on the
 * server — a joining socket gets a state frame to catch up after a reconnect,
 * so an active ask_user question reappears and queued messages are never
 * lost with a client disconnect. */
export function registerWorkspaceWs(app: FastifyInstance, hub: WorkspaceHub, repo: ArtisanRepo, runner: SessionRunner): void {
  app.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return socket.close(4401, "no identity");
    const workspaceId = ctx.workspaceId;

    socket.on("message", (raw: unknown) => {
      let frame: ClientFrame;
      try {
        frame = JSON.parse(String(raw)) as ClientFrame;
      } catch {
        return;
      }
      void (async () => {
        switch (frame.type) {
          case "join": {
            const session = await repo.getSession(workspaceId, frame.sessionId);
            if (!session) return socket.send(JSON.stringify({ sessionId: frame.sessionId, type: "error", message: "unknown session" }));
            hub.join(workspaceId, frame.sessionId, socket);
            // Catch the (re)joining client up with the live runtime state —
            // an ask_user question that's still open, messages queued while
            // no client was connected, whether a run is in flight.
            const live = runner.snapshot(frame.sessionId);
            socket.send(JSON.stringify({ sessionId: frame.sessionId, type: "state", title: session.title, ...live }));
            return;
          }
          case "leave": {
            hub.leave(workspaceId, frame.sessionId, socket);
            return;
          }
          case "send": {
            const session = await repo.getSession(workspaceId, frame.sessionId);
            if (!session) return;
            // Server-side queue: the runner starts the run when idle or
            // drains the queue when the current run finishes.
            await runner.enqueue(workspaceId, frame.sessionId, frame.text);
            return;
          }
          case "answer": {
            if (resolveAsk(frame.sessionId, frame.askId, frame.answers)) {
              hub.broadcast(workspaceId, frame.sessionId, { type: "ask_resolved" });
            }
            return;
          }
          case "cancel": {
            if (cancelAsk(frame.sessionId, frame.askId)) {
              hub.broadcast(workspaceId, frame.sessionId, { type: "ask_resolved" });
            }
            return;
          }
          case "typing":
            return;
        }
      })();
    });

    socket.on("close", () => hub.dropSocket(workspaceId, socket));
    socket.on("error", () => hub.dropSocket(workspaceId, socket));
  });

  // HTTP-side abort for completeness.
  app.post("/sessions/:id/abort", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const ok = abortSession(id);
    return { ok };
  });
}

