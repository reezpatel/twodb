import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import type { AgentFrame } from "../lib/agent-loop";
import { runAgentLoop } from "../lib/agent-loop";
import { projectHistory } from "../lib/compaction";
import { runAgentRound, type ThinkingLevel } from "../lib/agent";
import { resolveAskUser, type AskUserAnswer, type AskUserQuestion } from "../lib/ask-user";
import { readGitStatus } from "../lib/git-status";
import { runnerManager } from "../lib/runner-manager";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface ClientMessage {
  type: string;
  content?: string;
  connectionId?: string;
  model?: string;
  thinkingLevel?: string;
  /** Uploaded assets attached to the send — twodb:// refs from the composer. */
  assets?: { uri: string; filename: string; contentType: string }[];
  /** ask_user_response fields. */
  id?: string;
  cancelled?: boolean;
  answers?: unknown[];
  /** btw_done fields — sendToMain=false means just close (no summary round). */
  sendToMain?: boolean;
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
  sessionId: string;
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
  /** Open ask_user question — restored for late-joining sockets via run_state. */
  askUser: { id: string; questions: AskUserQuestion[] } | null;
}

const activeRuns = new Map<string, ActiveRun>();
const sockets = new Set<CodeSocket>();

// --- org-wide session list channel (sidebar realtime state) -----------------

interface SessionListSocket {
  ws: WSContext;
  organizationId: string;
}

const sessionListSockets = new Set<SessionListSocket>();

export type SessionListEvent =
  | { type: "session_created"; session: { id: string; title: string; codeDirectoryId: string | null; updatedAt: string } }
  | { type: "session_updated"; session: { id: string; title: string; updatedAt: string } }
  | { type: "session_deleted"; id: string }
  | { type: "session_state"; id: string; running: boolean; needsInput: boolean; unseenUpdates: boolean };

/** Fan a sidebar event out to every socket of the owning org. */
export function broadcastSessionEvent(organizationId: string, event: SessionListEvent) {
  const data = JSON.stringify(event);
  for (const s of sessionListSockets) {
    if (s.organizationId !== organizationId) continue;
    try {
      s.ws.send(data);
    } catch {
      sessionListSockets.delete(s);
    }
  }
}

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
      if (run.askUser?.id === frame.id) run.askUser = null;
      break;
    }
    case "ask_user":
      run.askUser = { id: frame.id, questions: frame.questions };
      break;
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
        askUser: run.askUser,
      }),
    );
  } catch {
    // socket gone; cleanup happens in onClose
  }
}

/** True while an agent loop is live on the session — compaction must not race it. */
export function isSessionRunning(sessionId: string): boolean {
  return activeRuns.has(sessionId);
}

export interface StartRunOptions {
  connectionId: string;
  model: string;
  thinkingLevel?: string | null;
  /** Socket that initiated the send — receives the live stream even if it's not the session's current viewer set. */
  ws?: WSContext;
  /** Extra meta stored on the inserted user message (e.g. btw send-to-main marker). */
  userMeta?: Record<string, unknown> | null;
  /** Assets attached to the user message (twodb:// refs). */
  assets?: { uri: string; filename: string; contentType: string }[];
}

/**
 * Shared run starter: persists the user message, registers the run, and drives
 * the agent loop. Used by both the regular `send` flow and /btw send-to-main
 * (which starts a round on the MAIN session from the btw session's socket).
 */
export async function startSessionRun(organizationId: string, session: SessionRow, content: string, opts: StartRunOptions) {
  const existingRun = activeRuns.get(session.id);
  if (existingRun) return { busy: true as const };

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
    .where("id", "=", opts.connectionId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!connection) return { error: "connection_not_found" as const };
  if (!connection.enabled) return { error: "connection_disabled" as const };

  const history = await db.selectFrom("code_session_message").selectAll().where("sessionId", "=", session.id).orderBy("createdAt", "asc").execute();
  const projectedHistory = projectHistory(history);
  const assets = opts.assets ?? [];

  const now = new Date();
  const isFirstMessage = history.length === 0;
  const meta = { ...(assets.length > 0 ? { images: assets } : {}), ...(opts.userMeta ?? {}) };
  await db
    .insertInto("code_session_message")
    .values({
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "user",
      content,
      meta: Object.keys(meta).length > 0 ? meta : null,
      createdAt: now,
    })
    .execute();
  await db
    .updateTable("code_session")
    .set({
      connectionId: opts.connectionId,
      model: opts.model,
      thinkingLevel: opts.thinkingLevel ?? undefined,
      updatedAt: now,
      ...(isFirstMessage ? { title: content.slice(0, 60) } : {}),
    })
    .where("id", "=", session.id)
    .execute();

  const run: ActiveRun = {
    controller: new AbortController(),
    sockets: new Set(),
    round: 0,
    text: "",
    thinking: "",
    thinkingOpen: false,
    tools: [],
    status: null,
    askUser: null,
  };
  // The initiating socket joins the broadcast set; any sockets already viewing
  // this session (e.g. the main thread behind a /btw dialog) join in too.
  if (opts.ws) run.sockets.add(opts.ws);
  for (const s of sockets) if (s.sessionId === session.id) run.sockets.add(s.ws);
  activeRuns.set(session.id, run);
  pushSessionState(organizationId, session.id);
  const emit = (frame: AgentFrame) => {
    accumulate(run, frame);
    broadcast(run, frame);
    if (frame.type === "ask_user") pushSessionState(organizationId, session.id, { needsInput: true });
    else if (frame.type === "tool_result" && run.askUser?.id === frame.id) pushSessionState(organizationId, session.id, { needsInput: false });
  };

  try {
    await runAgentLoop(
      {
        session,
        connection,
        model: opts.model,
        runnerId,
        cwd,
        signal: run.controller.signal,
        thinkingLevel: (opts.thinkingLevel ?? undefined) as ThinkingLevel | undefined,
        history: projectedHistory,
        userContent: content,
        ...(assets.length > 0 ? { userImages: assets } : {}),
        organizationId,
      },
      emit,
    );
  } finally {
    activeRuns.delete(session.id);
    // Completed while the user was elsewhere — flag it for the sidebar.
    const watched = run.sockets.size > 0;
    if (!watched) {
      try {
        await db.updateTable("code_session").set({ unseenUpdates: true }).where("id", "=", session.id).execute();
      } catch {
        // state flag is cosmetic — never fail the run on it
      }
    }
    pushSessionState(organizationId, session.id, { unseenUpdates: !watched });
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
  return { ok: true as const };
}

export type SessionRow = NonNullable<Awaited<ReturnType<typeof fetchSessionRow>>>;
async function fetchSessionRow(id: string) {
  return db.selectFrom("code_session").selectAll().where("id", "=", id).executeTakeFirst();
}

/** True when the session has no committed messages — used to push session_updated (first-message title). */
async function historyWasEmpty(sessionId: string) {
  const row = await db
    .selectFrom("code_session_message")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("sessionId", "=", sessionId)
    .executeTakeFirst();
  return Number(row?.count ?? 0) <= 1;
}

/** Sidebar state for one session: run/needsInput/unseen, pushed to the org channel. */
export function pushSessionState(organizationId: string, sessionId: string, overrides?: Partial<{ needsInput: boolean; unseenUpdates: boolean }>) {
  const run = activeRuns.get(sessionId);
  const running = run !== undefined;
  const needsInput = overrides?.needsInput ?? (run?.askUser != null);
  const unseenUpdates = overrides?.unseenUpdates ?? false;
  broadcastSessionEvent(organizationId, { type: "session_state", id: sessionId, running, needsInput, unseenUpdates });
}

/** Fan a frame out to every socket currently viewing this session. */
export function broadcastToSession(sessionId: string, frame: unknown) {
  const data = JSON.stringify(frame);
  for (const s of sockets) {
    if (s.sessionId !== sessionId) continue;
    try {
      s.ws.send(data);
    } catch {
      sockets.delete(s);
    }
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
  runnerManager.onChange(() => void pushRunners([...sockets]));

  // Org-wide sidebar channel: coarse per-session state (running, needsInput,
  // unseen) plus created/updated/deleted notifications. One socket per browser
  // tab regardless of how many sessions exist.
  app.get(
    "/api/code/sessions-ws",
    upgradeWebSocket((c: Context) => {
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);
      let socket: SessionListSocket | null = null;
      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, organizationId };
          sessionListSockets.add(socket);
        },
        onClose() {
          if (socket) sessionListSockets.delete(socket);
        },
        async onMessage(evt: { data: unknown }, ws: WSContext) {
          if (parseMessage(evt.data)?.type === "ping") {
            try {
              ws.send(JSON.stringify({ type: "pong" }));
            } catch {
              // socket gone
            }
          }
        },
      };
    }),
  );

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
          socket = { ws, organizationId, sessionId };
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

          // Answers to an open ask_user question — any viewer may answer.
          if (msg.type === "ask_user_response") {
            const toAnswer = (a: unknown): AskUserAnswer | null =>
              typeof a === "string" && a.trim() ? a : Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === "string") ? a : null;
            const answers = Array.isArray(msg.answers) ? msg.answers.map(toAnswer).filter((a): a is AskUserAnswer => a !== null) : undefined;
            resolveAskUser(sessionId, typeof msg.id === "string" ? msg.id : "", {
              cancelled: msg.cancelled === true,
              answers,
            });
            return;
          }

          // /btw side thread finished — summarize the btw session with the same
          // LLM, insert the summary into the MAIN session, trigger a round
          // there (send-to-main), and lock the btw session read-only.
          if (msg.type === "btw_done") {
            try {
              const connectionId = msg.connectionId ?? "";
              const model = (msg.model ?? "").trim();
              const sendToMain = msg.sendToMain !== false;
              if (!connectionId || !model) {
                ws.send(JSON.stringify({ type: "error", message: "connection_and_model_required" }));
                return;
              }

              const btw = await db
                .selectFrom("code_session")
                .selectAll()
                .where("id", "=", sessionId)
                .where("organizationId", "=", organizationId)
                .executeTakeFirst();
              if (!btw) {
                ws.send(JSON.stringify({ type: "error", message: "session_not_found" }));
                return;
              }
              if (!btw.parentSessionId) {
                ws.send(JSON.stringify({ type: "error", message: "not_a_btw_session" }));
                return;
              }
              if (btw.locked) {
                ws.send(JSON.stringify({ type: "error", message: "btw_already_done" }));
                return;
              }
              if (activeRuns.has(sessionId)) {
                ws.send(JSON.stringify({ type: "error", message: "btw_run_in_progress" }));
                return;
              }

              ws.send(JSON.stringify({ type: "btw_status", text: sendToMain ? "summarizing…" : "closing" }));

              const agent = btw.agentId
                ? await db
                    .selectFrom("agent")
                    .select(["description", "provider", "model"])
                    .where("id", "=", btw.agentId)
                    .where("organizationId", "=", organizationId)
                    .executeTakeFirst()
                : undefined;
              const agentName = agent?.description?.trim() || "Agent";

              let summary: string | null = null;
              if (sendToMain) {
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

                const rows = await db
                  .selectFrom("code_session_message")
                  .selectAll()
                  .where("sessionId", "=", btw.id)
                  .orderBy("createdAt", "asc")
                  .execute();
                const projected = projectHistory(rows);
                const conversation = projected
                  .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                  .join("\n\n")
                  .slice(0, 100_000);
                const result = await runAgentRound(
                  connection,
                  model,
                  [
                    {
                      role: "system",
                      content:
                        "You are a summarization assistant. Read a side conversation between a user and an agent and produce a concise summary that will be handed to the main agent thread. Do NOT continue the conversation. ONLY output the summary.",
                      meta: null,
                    },
                    {
                      role: "user",
                      content: `<side-conversation with agent "${agentName}">\n${conversation}\n</side-conversation>\n\nSummarize this side conversation: what was asked, what the agent found/did, and the conclusions. Be concise (a few paragraphs at most); preserve exact file paths, commands, and error messages.`,
                      meta: null,
                    },
                  ],
                  [],
                  () => {},
                );
                summary = (result.content ?? "").trim();
                if (!summary) {
                  ws.send(JSON.stringify({ type: "error", message: "btw_summary_failed" }));
                  return;
                }
              }

              // Lock the btw session read-only.
              const now = new Date();
              await db
                .updateTable("code_session")
                .set({
                  locked: true,
                  runtimeState: JSON.stringify({ ...((btw.runtimeState ?? {}) as Record<string, unknown>), btwDone: true }),
                  updatedAt: now,
                })
                .where("id", "=", btw.id)
                .execute();

              // Marker row inside the btw thread (rendered as a closed block).
              await db
                .insertInto("code_session_message")
                .values({
                  id: crypto.randomUUID(),
                  sessionId: btw.id,
                  role: "btw_done",
                  content: summary ?? "",
                  meta: { sendToMain, agentName, mainSessionId: btw.parentSessionId },
                  createdAt: now,
                })
                .execute();

              const main = await db
                .selectFrom("code_session")
                .selectAll()
                .where("id", "=", btw.parentSessionId)
                .where("organizationId", "=", organizationId)
                .executeTakeFirst();
              if (main) {
                if (sendToMain && !activeRuns.has(main.id)) {
                  const started = await startSessionRun(organizationId, main, `[Agent ${agentName} — /btw summary]\n\n${summary}`, {
                    connectionId,
                    model,
                    thinkingLevel: msg.thinkingLevel ?? null,
                    ws,
                    userMeta: { btw: { agentName, btwSessionId: btw.id, sendToMain: true } },
                  });
                  if ("error" in started) ws.send(JSON.stringify({ type: "error", message: started.error }));
                  else if ("busy" in started) ws.send(JSON.stringify({ type: "error", message: "main_run_in_progress" }));
                  else ws.send(JSON.stringify({ type: "btw_done_ok", sendToMain: true }));
                } else {
                  // "done" only (or main busy): a clickable block in the main
                  // transcript; no round until the next user message.
                  await db
                    .insertInto("code_session_message")
                    .values({
                      id: crypto.randomUUID(),
                      sessionId: main.id,
                      role: "btw",
                      content: summary ?? "",
                      meta: { agentName, btwSessionId: btw.id, sendToMain, closed: true },
                      createdAt: new Date(),
                    })
                    .execute();
                  broadcastToSession(main.id, { type: "session_updated" });
                  ws.send(JSON.stringify({ type: "btw_done_ok", sendToMain: sendToMain && activeRuns.has(main.id) ? null : false }));
                }
              } else {
                ws.send(JSON.stringify({ type: "btw_done_ok", sendToMain: false }));
              }
              broadcastToSession(btw.id, { type: "session_updated" });
            } catch (e) {
              console.error("[code-ws] btw_done failed:", e);
              try {
                ws.send(JSON.stringify({ type: "error", message: (e as Error).message }));
              } catch {
                // socket gone
              }
            }
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

            if (session.locked) {
              ws.send(JSON.stringify({ type: "error", message: "session_locked" }));
              return;
            }

            const assets = Array.isArray(msg.assets)
              ? msg.assets.filter((a) => a && typeof a.uri === "string" && typeof a.filename === "string" && typeof a.contentType === "string")
              : [];

            const started = await startSessionRun(organizationId, session, content, {
              connectionId,
              model,
              thinkingLevel,
              ws,
              assets,
            });
            if ("error" in started) {
              ws.send(JSON.stringify({ type: "error", message: started.error }));
              return;
            }
            if ("busy" in started) {
              const existingRun = activeRuns.get(session.id);
              if (existingRun) {
                existingRun.sockets.add(ws);
                sendRunState(existingRun, ws);
              }
              ws.send(JSON.stringify({ type: "busy" }));
              return;
            }
            if (await historyWasEmpty(session.id)) ws.send(JSON.stringify({ type: "session_updated" }));
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
