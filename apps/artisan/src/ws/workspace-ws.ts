import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { ArtisanRepo } from "../db/repository.js";
import type { WorkspaceHub, ClientFrame } from "./hub.js";
import { readForwardedContext } from "../gateway-context.js";
import { runAgentLoop, isSessionRunning, resolveAsk, cancelAsk, abortSession, type RunDeps } from "./agent-loop.js";

/** Workspace WS: one per workspace; join/leave session rooms; viewer input. */
export function registerWorkspaceWs(app: FastifyInstance, hub: WorkspaceHub, repo: ArtisanRepo, deps: RunDeps): void {
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
            socket.send(JSON.stringify({ sessionId: frame.sessionId, type: "joined", title: session.title }));
            return;
          }
          case "leave": {
            hub.leave(workspaceId, frame.sessionId, socket);
            return;
          }
          case "send": {
            const session = await repo.getSession(workspaceId, frame.sessionId);
            if (!session) return;
            if (isSessionRunning(frame.sessionId)) {
              return hub.broadcast(workspaceId, frame.sessionId, { type: "error", message: "session already running" });
            }
            const agent = session.agent_id
              ? await repo.getAgent(workspaceId, session.agent_id)
              : await repo.getOrCreateDirectoryAgent(workspaceId, session.space_id, session.runner, session.directory);
            if (!agent) return hub.broadcast(workspaceId, frame.sessionId, { type: "error", message: "agent config missing" });
            // fire-and-forget: frames stream to the room
            void runAgentLoop({ deps, session, agent, model: session.model, apiKey: "", userMessage: frame.text }).catch((err) => {
              hub.broadcast(workspaceId, frame.sessionId, { type: "error", message: (err as Error).message });
              hub.broadcast(workspaceId, frame.sessionId, { type: "done", ok: false, message: (err as Error).message });
            });
            return;
          }
          case "answer": {
            resolveAsk(frame.sessionId, frame.askId, frame.answers);
            hub.broadcast(workspaceId, frame.sessionId, { type: "ask_resolved" });
            return;
          }
          case "cancel": {
            cancelAsk(frame.sessionId, frame.askId);
            hub.broadcast(workspaceId, frame.sessionId, { type: "ask_resolved" });
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
