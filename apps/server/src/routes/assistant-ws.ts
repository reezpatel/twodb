import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import { runAssistantLoop, type AssistantFrame } from "../lib/agent/assistant-loop";
import type { AgentMessage } from "../lib/agent";

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

/** Live channel for one assistant thread — mirrors the code-session socket. */
export function registerAssistantWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  app.get(
    "/api/assistant/threads/:id/ws",
    upgradeWebSocket((c: Context) => {
      const threadId = c.req.param("id") ?? "";
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          if (!(await orgReady)) ws.close(4401, "unauthorized");
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
          const content = (msg.content ?? "").trim();
          const connectionId = msg.connectionId ?? "";
          const model = (msg.model ?? "").trim();
          if (!content || !connectionId || !model) {
            ws.send(JSON.stringify({ type: "error", message: "connection_and_model_required" }));
            return;
          }

          const thread = await db
            .selectFrom("assistant_thread")
            .selectAll()
            .where("id", "=", threadId)
            .where("organizationId", "=", organizationId)
            .executeTakeFirst();
          if (!thread) {
            ws.send(JSON.stringify({ type: "error", message: "thread_not_found" }));
            return;
          }

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

          const history = await db.selectFrom("assistant_message").selectAll().where("threadId", "=", thread.id).orderBy("createdAt", "asc").execute();

          const now = new Date();
          const isFirstMessage = history.length === 0;
          await db
            .insertInto("assistant_message")
            .values({ id: crypto.randomUUID(), threadId: thread.id, role: "user", content, meta: null, createdAt: now })
            .execute();
          await db
            .updateTable("assistant_thread")
            .set({
              connectionId,
              model,
              updatedAt: now,
              ...(isFirstMessage ? { title: content.slice(0, 60) } : {}),
            })
            .where("id", "=", thread.id)
            .execute();
          if (isFirstMessage) {
            ws.send(JSON.stringify({ type: "thread_updated" }));
          }

          const emit = (frame: AssistantFrame) => {
            try {
              ws.send(JSON.stringify(frame));
            } catch {
              // client gone mid-loop; keep persisting
            }
          };

          await runAssistantLoop(
            {
              thread,
              connection,
              model,
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
        },
      };
    }),
  );
}
