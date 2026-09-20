import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { WebSocket } from "ws";
import type { CodeTables } from "./db";
import { runtime } from "./runtime";
import { runSession } from "./harness";
import { hydrateSessionEvents } from "./history";
import type { CodeSessionClientMessage, CodeSessionEvent, CodeSessionServerMessage } from "../shared/api";
import type {} from "@twodb/workspace/shared/fn";
import type {} from "@twodb/auth/shared/fn";

type SessionRow = {
  id: string;
  workspace_id: string;
  node_id: string;
  title: string;
  folder: string;
  connection_id: string | null;
  model: string | null;
};

const loadSession = async (kysely: Kysely<CodeTables>, id: string, workspaceId: string): Promise<SessionRow | null> =>
  (await kysely.selectFrom("code_sessions").selectAll().where("id", "=", id).where("workspace_id", "=", workspaceId).limit(1).executeTakeFirst()) ?? null;

export async function registerSessionSocket(
  kysely: Kysely<CodeTables>,
  invoke: <T>(name: string, ...args: unknown[]) => Promise<T>,
  app: FastifyInstance,
): Promise<void> {
  await app.register(import("@fastify/websocket"));

  app.get<{ Querystring: { workspace?: string } }>("/ws", { websocket: true }, async (socket: WebSocket, request) => {
    const userId = request.userId;
    if (!userId) {
      socket.close(4001, "unauthorized");
      return;
    }

    // Websocket upgrades cannot carry the x-workspace-id header, so the
    // client passes the workspace explicitly in the query string. Cookie-
    // derived context (already ownership-validated via /active) still works;
    // a query workspace is validated here before it is trusted.
    let workspaceId = request.workspaceId;
    const queryWorkspace = typeof request.query.workspace === "string" && request.query.workspace.length > 0 ? request.query.workspace : null;
    if (queryWorkspace && queryWorkspace !== workspaceId) {
      const owns = await invoke<boolean>("workspace.owns", { workspaceId: queryWorkspace, userId });
      if (!owns) {
        socket.close(4003, "workspace_forbidden");
        return;
      }
      workspaceId = queryWorkspace;
    }
    if (!workspaceId) {
      socket.close(4002, "workspace_required");
      return;
    }

    request.log.info({ workspaceId }, "code-ws client connected");
    socket.on("close", (code, reason) => {
      request.log.info({ code, reason: String(reason) }, "code-ws client disconnected");
    });

    const send = (message: CodeSessionServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    const subscriptions = new Map<string, () => void>();

    const detach = (sessionId: string) => {
      const off = subscriptions.get(sessionId);
      if (off) {
        off();
        subscriptions.delete(sessionId);
      }
    };

    socket.on("message", (raw: unknown) => {
      void (async () => {
        let parsed: CodeSessionClientMessage;
        try {
          parsed = JSON.parse(String(raw)) as CodeSessionClientMessage;
        } catch {
          send({ kind: "error", message: "malformed message" });
          return;
        }

        switch (parsed.kind) {
          case "subscribe": {
            const session = await loadSession(kysely, parsed.sessionId, workspaceId);
            if (!session) {
              send({ kind: "error", message: "session_not_found" });
              return;
            }
            detach(session.id);
            if (runtime.events(session.id).length === 0) {
              runtime.seed(session.id, await hydrateSessionEvents(kysely, session.id));
            }
            const snapshot: CodeSessionEvent[] = runtime.events(session.id);
            const off = runtime.attach(session.id, (event) => send({ kind: "event", sessionId: session.id, event }));
            subscriptions.set(session.id, off);
            send({ kind: "subscribed", sessionId: session.id, snapshot });
            return;
          }
          case "unsubscribe": {
            detach(parsed.sessionId);
            send({ kind: "unsubscribed", sessionId: parsed.sessionId });
            return;
          }
          case "send": {
            const session = await loadSession(kysely, parsed.sessionId, workspaceId);
            if (!session) {
              send({ kind: "error", message: "session_not_found" });
              return;
            }
            if (!parsed.message?.trim()) {
              send({ kind: "error", message: "empty_message" });
              return;
            }
            runSession({ kysely, invoke }, session, parsed.message.trim());
            return;
          }
          case "set_connection": {
            const session = await loadSession(kysely, parsed.sessionId, workspaceId);
            if (!session) {
              send({ kind: "error", message: "session_not_found" });
              return;
            }
            await kysely
              .updateTable("code_sessions")
              .set({ connection_id: parsed.connectionId ?? null, updated_at: new Date() })
              .where("id", "=", session.id)
              .execute();
            return;
          }
          case "set_model": {
            const session = await loadSession(kysely, parsed.sessionId, workspaceId);
            if (!session) {
              send({ kind: "error", message: "session_not_found" });
              return;
            }
            await kysely
              .updateTable("code_sessions")
              .set({ model: parsed.model ?? null, updated_at: new Date() })
              .where("id", "=", session.id)
              .execute();
            return;
          }
          default:
            return;
        }
      })();
    });

    socket.on("close", () => {
      for (const off of subscriptions.values()) off();
      subscriptions.clear();
    });
  });
}
