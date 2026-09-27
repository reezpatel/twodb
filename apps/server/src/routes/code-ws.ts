import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import type { AgentFrame } from "../lib/agent-loop";
import { runAgentLoop } from "../lib/agent-loop";
import type { AgentMessage } from "../lib/agent";
import { runnerManager } from "../lib/runner-manager";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface ClientMessage {
  type: string;
  content?: string;
  connectionId?: string;
  model?: string;
}

function parseMessage(data: unknown): ClientMessage | null {
  try {
    return JSON.parse(String(data)) as ClientMessage;
  } catch {
    return null;
  }
}

interface CodeSocket {
  ws: WSContext;
  organizationId: string;
}

async function runnersForOrg(organizationId: string) {
  const rows = await db
    .selectFrom("runner")
    .select(["id", "name", "hostname"])
    .where("organizationId", "=", organizationId)
    .where("deletedAt", "is", null)
    .orderBy("createdAt", "asc")
    .execute();
  const online = runnerManager.onlineIds();
  return rows.map((r) => ({ ...r, online: online.has(r.id) }));
}

async function pushRunners(targets: CodeSocket[], only?: CodeSocket) {
  const org = only?.organizationId;
  const group = only ? targets.filter((s) => s.organizationId === org) : targets;
  const orgs = new Set(group.map((s) => s.organizationId));
  for (const organizationId of orgs) {
    const runners = await runnersForOrg(organizationId);
    for (const s of group) {
      if (s.organizationId !== organizationId) continue;
      try {
        s.ws.send(JSON.stringify({ type: "runners", runners }));
      } catch {
        // socket gone; cleanup happens in onClose
      }
    }
  }
}

/**
 * Live channel for one code session. The browser opens this when a session is
 * selected and sends `send` messages; the agent loop streams every frame
 * (model deltas, tool output chunks, results) back over the socket.
 */
export function registerCodeWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  const sockets = new Set<CodeSocket>();
  runnerManager.onChange(() => void pushRunners([...sockets]));

  app.get(
    "/api/code/sessions/:id/ws",
    upgradeWebSocket((c: Context) => {
      const sessionId = c.req.param("id") ?? "";
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);

      let socket: CodeSocket | null = null;

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, organizationId };
          sockets.add(socket);
          await pushRunners([...sockets], socket);
        },

        onClose() {
          if (socket) sockets.delete(socket);
        },

        async onMessage(evt: { data: unknown }, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) return;
          const msg = parseMessage(evt.data);
          if (!msg) return;

          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }

          if (msg.type !== "send") return;
          try {
            const content = (msg.content ?? "").trim();
            const connectionId = msg.connectionId ?? "";
            const model = (msg.model ?? "").trim();
            if (!content || !connectionId || !model) {
              ws.send(JSON.stringify({ type: "error", message: "connection_and_model_required" }));
              return;
            }

            const session = await db
              .selectFrom("code_session")
              .selectAll()
              .where("id", "=", sessionId)
              .where("organizationId", "=", organizationId)
              .executeTakeFirst();
            if (!session) {
              ws.send(JSON.stringify({ type: "error", message: "session_not_found" }));
              return;
            }

            const directory = session.codeDirectoryId
              ? await db
                  .selectFrom("code_directory")
                  .select("runnerId")
                  .where("id", "=", session.codeDirectoryId)
                  .where("organizationId", "=", organizationId)
                  .executeTakeFirst()
              : undefined;
            const runnerId = directory?.runnerId ?? null;

            const connection = await db
              .selectFrom("llm_connection")
              .selectAll()
              .where("id", "=", connectionId)
              .where("organizationId", "=", organizationId)
              .executeTakeFirst();
            if (!connection) {
              ws.send(JSON.stringify({ type: "error", message: "connection_not_found" }));
              return;
            }
            if (!connection.enabled) {
              ws.send(JSON.stringify({ type: "error", message: "connection_disabled" }));
              return;
            }

            const history = await db.selectFrom("code_session_message").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "asc").execute();

            const now = new Date();
            const isFirstMessage = history.length === 0;
            await db
              .insertInto("code_session_message")
              .values({
                id: crypto.randomUUID(),
                sessionId: session.id,
                role: "user",
                content,
                meta: null,
                createdAt: now,
              })
              .execute();
            await db
              .updateTable("code_session")
              .set({
                connectionId,
                model,
                updatedAt: now,
                ...(isFirstMessage ? { title: content.slice(0, 60) } : {}),
              })
              .where("id", "=", session.id)
              .execute();
            if (isFirstMessage) {
              ws.send(JSON.stringify({ type: "session_updated" }));
            }

            const emit = (frame: AgentFrame) => {
              try {
                ws.send(JSON.stringify(frame));
              } catch {
                // client gone mid-loop; keep persisting
              }
            };

            await runAgentLoop(
              {
                session,
                connection,
                model,
                runnerId,
                history: history.map((m) => ({
                  role: m.role as AgentMessage["role"],
                  content: m.content,
                  meta: (m.meta as AgentMessage["meta"]) ?? null,
                })),
                userContent: content,
                organizationId,
              },
              emit,
            );
          } catch (e) {
            console.error("[code-ws] send failed:", e);
            try {
              ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
            } catch {
              // socket gone
            }
          }
        },
      };
    }),
  );
}
