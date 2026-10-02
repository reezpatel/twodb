import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import type { AgentFrame } from "../lib/agent-loop";
import { runAgentLoop } from "../lib/agent-loop";
import { readGitStatus } from "../lib/git-status";
import type { AgentMessage } from "../lib/agent";
import { runnerManager } from "../lib/runner-manager";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface ClientMessage {
  type: string;
  content?: string;
  connectionId?: string;
  model?: string;
  thinkingLevel?: string;
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

interface LiveTool {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  output: string;
  done: boolean;
}

/**
 * A running agent loop, keyed by session id. Frames accumulate replay state so
 * a socket that connects mid-run can catch up, and every subscribed socket
 * receives the live stream — the loop is owned by the server, not the socket
 * that started it.
 */
interface ActiveRun {
  /** Aborted by the client's stop message; the loop unwinds gracefully. */
  controller: AbortController;
  sockets: Set<WSContext>;
  round: number;
  text: string;
  thinking: string;
  thinkingOpen: boolean;
  tools: LiveTool[];
  status: string | null;
}

const activeRuns = new Map<string, ActiveRun>();

function accumulate(run: ActiveRun, frame: AgentFrame) {
  switch (frame.type) {
    case "round_start":
      // Snapshot tracks only the in-flight round; earlier rounds are committed
      // to the DB and refetched over REST by clients.
      run.round = frame.round;
      run.text = "";
      run.tools = [];
      run.thinking = "";
      run.thinkingOpen = false;
      break;
    case "thinking_start":
      run.thinking = "";
      run.thinkingOpen = true;
      break;
    case "thinking_delta":
      run.thinking += frame.text;
      break;
    case "thinking_end":
      run.thinkingOpen = false;
      break;
    case "delta":
      run.text += frame.text;
      break;
    case "tool_start":
      run.tools.push({ id: frame.id, name: frame.name, args: frame.args, output: "", done: false });
      break;
    case "tool_output": {
      const tool = run.tools.find((t) => t.id === frame.id);
      if (tool) tool.output += frame.data;
      break;
    }
    case "tool_result": {
      const tool = run.tools.find((t) => t.id === frame.id);
      if (tool) {
        tool.output = frame.output;
        tool.done = true;
      }
      break;
    }
    case "status":
      run.status = frame.text;
      break;
  }
}

function broadcast(run: ActiveRun, frame: AgentFrame) {
  const data = JSON.stringify(frame);
  for (const target of run.sockets) {
    try {
      target.send(data);
    } catch {
      run.sockets.delete(target);
    }
  }
}

/** Snapshot a late-joining socket can use to render the run as if it had been watching from the start. */
function sendRunState(run: ActiveRun, ws: WSContext) {
  try {
    ws.send(
      JSON.stringify({
        type: "run_state",
        active: true,
        round: run.round,
        text: run.text,
        thinking: run.thinking,
        thinkingOpen: run.thinkingOpen,
        tools: run.tools,
        status: run.status,
      }),
    );
  } catch {
    // socket gone; cleanup happens in onClose
  }
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
          const run = activeRuns.get(sessionId);
          if (run) {
            run.sockets.add(ws);
            sendRunState(run, ws);
          } else {
            // No run in flight — lets clients that missed `done` drop stale transient state.
            try {
              ws.send(JSON.stringify({ type: "run_state", active: false }));
            } catch {
              // socket gone; cleanup happens in onClose
            }
          }
        },

        onClose() {
          if (socket) {
            sockets.delete(socket);
            for (const run of activeRuns.values()) run.sockets.delete(socket.ws);
          }
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

          if (msg.type === "stop") {
            activeRuns.get(sessionId)?.controller.abort();
            return;
          }

          if (msg.type !== "send") return;
          try {
            const content = (msg.content ?? "").trim();
            const connectionId = msg.connectionId ?? "";
            const model = (msg.model ?? "").trim();
            const thinkingLevel =
              msg.thinkingLevel === "off" || msg.thinkingLevel === "low" || msg.thinkingLevel === "medium" || msg.thinkingLevel === "high"
                ? msg.thinkingLevel
                : null;
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

            const existingRun = activeRuns.get(session.id);
            if (existingRun) {
              existingRun.sockets.add(ws);
              sendRunState(existingRun, ws);
              ws.send(JSON.stringify({ type: "busy" }));
              return;
            }

            const directory = session.codeDirectoryId
              ? await db
                  .selectFrom("code_directory")
                  .select(["runnerId", "cwd"])
                  .where("id", "=", session.codeDirectoryId)
                  .where("organizationId", "=", organizationId)
                  .executeTakeFirst()
              : undefined;
            const runnerId = directory?.runnerId ?? null;
            const cwd = directory?.cwd ?? null;

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
                thinkingLevel,
                updatedAt: now,
                ...(isFirstMessage ? { title: content.slice(0, 60) } : {}),
              })
              .where("id", "=", session.id)
              .execute();
            if (isFirstMessage) {
              ws.send(JSON.stringify({ type: "session_updated" }));
            }

            const run: ActiveRun = {
              controller: new AbortController(),
              sockets: new Set([ws]),
              round: 0,
              text: "",
              thinking: "",
              thinkingOpen: false,
              tools: [],
              status: null,
            };
            activeRuns.set(session.id, run);
            const emit = (frame: AgentFrame) => {
              accumulate(run, frame);
              broadcast(run, frame);
            };

            try {
              await runAgentLoop(
                {
                  session,
                  connection,
                  model,
                  runnerId,
                  cwd,
                  signal: run.controller.signal,
                  thinkingLevel: thinkingLevel ?? undefined,
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
            } finally {
              activeRuns.delete(session.id);
              // The run just touched files — refresh the footer git line.
              void (async () => {
                if (!directory) return;
                const result = await readGitStatus(directory.runnerId, directory.cwd);
                if ("error" in result) return;
                const data = JSON.stringify({ type: "gitStatus", ...result });
                for (const target of run.sockets) {
                  try {
                    target.send(data);
                  } catch {
                    run.sockets.delete(target);
                  }
                }
              })();
            }
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
