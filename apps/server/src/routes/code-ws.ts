import type { Context, Hono } from "hono";
import type { WSContext } from "hono/ws";
import type { createNodeWebSocket } from "@hono/node-ws";
import { auth, db } from "../auth";
import type { AgentFrame } from "../lib/agent-loop";
import { logger } from "../lib/logger";
import type { AgentMessage } from "../lib/agent";
import { runAgentLoop } from "../lib/agent-loop";
import { projectHistory } from "../lib/compaction";
import { runAgentRound, type ThinkingLevel } from "../lib/agent";
import { resolveAskUser, type AskUserAnswer, type AskUserQuestion } from "../lib/ask-user";
import { readGitStatus } from "../lib/git-status";
import { onMetrics, allLatestMetrics } from "../lib/runner-metrics";
import { runnerManager } from "../lib/runner-manager";
import { notify } from "../lib/notifications/notify";

type UpgradeWebSocket = ReturnType<typeof createNodeWebSocket>["upgradeWebSocket"];

interface ClientMessage {
  type: string;
  /** Session the message targets (room protocol — one socket serves many sessions). */
  session?: string;
  content?: string;
  connectionId?: string;
  model?: string;
  thinkingLevel?: string;
  /** Uploaded assets attached to the send — twodb:// refs from the composer. */
  assets?: { uri: string; filename: string; contentType: string }[];
  /** Expanded skills from the composer — stored on the user row meta. */
  skills?: { name: string; content: string }[];
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
  /** Joined session rooms — `session:<id>`. The org room is implicit (auth). */
  rooms: Set<string>;
  /** Subscribed to live runner metrics (resources room). */
  resourcesSubscribed: boolean;
}

/** Room name for a session's viewers. */
const sessionRoom = (sessionId: string) => `session:${sessionId}`;

/** Wrap a frame in its room envelope — every routed frame uses this, direct
 * replies included, so panels sharing one socket never cross-talk. */
function roomFrame(room: string, frame: unknown) {
  return JSON.stringify({ type: "room", room, frame });
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
  /** Rooms to broadcast to — mirrors the session room membership. */
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

/** Sessions with a manual compaction POST in flight — viewers that connect
 * (or refresh) mid-compaction resume the "compacting…" indicator from it. */
const compactingSessions = new Set<string>();

/** Marks a session as compacting and tells every current viewer. */
export function beginCompaction(sessionId: string) {
  compactingSessions.add(sessionId);
  broadcastToSession(sessionId, { type: "compaction_state", active: true });
}

/** Compaction ended (done or failed) — clear the flag and tell the viewers. */
export function endCompaction(sessionId: string) {
  compactingSessions.delete(sessionId);
  broadcastToSession(sessionId, { type: "compaction_state", active: false });
}

export function isCompacting(sessionId: string) {
  return compactingSessions.has(sessionId);
}

// --- org-wide session list channel (sidebar realtime state) -----------------

export type SessionListEvent =
  | { type: "session_created"; session: { id: string; title: string; codeDirectoryId: string | null; updatedAt: string } }
  | { type: "session_updated"; session: { id: string; title: string; updatedAt: string } }
  | { type: "session_deleted"; id: string }
  | { type: "session_state"; id: string; running: boolean; needsInput: boolean; unseenUpdates?: boolean };

/** Fan a sidebar event out to every socket of the owning org — the org room
 * is implicit: every connected socket of the org is in it. */
export function broadcastSessionEvent(organizationId: string, event: SessionListEvent) {
  const data = JSON.stringify(event);
  for (const s of sockets) {
    if (s.organizationId !== organizationId) continue;
    try {
      s.ws.send(data);
    } catch {
      sockets.delete(s);
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

function broadcast(run: ActiveRun, frame: AgentFrame, sessionId: string) {
  const data = roomFrame(sessionRoom(sessionId), frame);
  for (const target of run.sockets) {
    try {
      target.send(data);
    } catch {
      run.sockets.delete(target);
    }
  }
}

/** Snapshot a late-joining socket can use to render the run as if it had been watching from the start. */
function sendRunState(run: ActiveRun, ws: WSContext, sessionId: string) {
  try {
    ws.send(
      roomFrame(sessionRoom(sessionId), {
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
  /** Expanded skills the composer sent — stored on the user row meta so the
   * transcript renders chips instead of the raw expanded content. */
  skills?: { name: string; content: string }[];
  /** Replaces the DB-projected history (chat channels project chat_message rows instead). */
  historyOverride?: AgentMessage[];
  /** Replaces the bound agent's instruction as the system prompt body. */
  systemPromptOverride?: string | null;
  /** Keep the session title on first message (chat sessions carry their own title). */
  titleLocked?: boolean;
  /** Live frame tap for callers that don't own a socket (chat agent state). */
  onFrame?: (frame: AgentFrame) => void;
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
  const skills = (opts.skills ?? []).filter((s) => s && typeof s.name === "string" && typeof s.content === "string");
  const meta = {
    ...(assets.length > 0 ? { images: assets } : {}),
    ...(skills.length > 0 ? { skills } : {}),
    ...(opts.userMeta ?? {}),
  };
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
      ...(isFirstMessage && !opts.titleLocked ? { title: content.slice(0, 60) } : {}),
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
  // The initiating socket joins the broadcast set; any sockets in the
  // session's room (e.g. the main thread behind a /btw dialog) join in too.
  const room = sessionRoom(session.id);
  if (opts.ws) run.sockets.add(opts.ws);
  for (const s of sockets) if (s.rooms.has(room)) run.sockets.add(s.ws);
  activeRuns.set(session.id, run);
  logger.info({ sessionId: session.id, organizationId, model: opts.model, connectionId: opts.connectionId, sessionType: session.type }, "session run started");
  pushSessionState(organizationId, session.id);
  const emit = (frame: AgentFrame) => {
    accumulate(run, frame);
    broadcast(run, frame, session.id);
    if (opts.onFrame) opts.onFrame(frame);
    if (frame.type === "ask_user") {
      pushSessionState(organizationId, session.id, { needsInput: true });
      if (run.sockets.size === 0) {
        void notify({
          organizationId,
          type: "core.agent",
          audience: { kind: "org" },
          title: `Agent needs your answer`,
          body: frame.questions[0]?.question ?? session.title,
          urgency: "high",
          icon: "agent",
          deepLink: `twodb://code/session/${session.id}`,
          dedupeKey: `core.agent.ask:${frame.id}`,
          data: { sessionId: session.id, callId: frame.id },
        }).catch(() => {});
      }
    } else if (frame.type === "tool_result" && run.askUser?.id === frame.id) pushSessionState(organizationId, session.id, { needsInput: false });
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
        history: opts.historyOverride ?? projectedHistory,
        userContent: content,
        ...(assets.length > 0 ? { userImages: assets } : {}),
        organizationId,
        ...(opts.systemPromptOverride !== undefined ? { systemPromptOverride: opts.systemPromptOverride } : {}),
      },
      emit,
    );
  } finally {
    activeRuns.delete(session.id);
    logger.info({ sessionId: session.id, organizationId, watched: run.sockets.size > 0 }, "session run finished");
    // Round finished — mark the session unseen. The UI hides the marker for the
    // session being viewed and sends the seen signal (POST /sessions/:id/seen).
    try {
      await db.updateTable("code_session").set({ unseenUpdates: true }).where("id", "=", session.id).execute();
    } catch {
      // state flag is cosmetic — never fail the run on it
    }
    pushSessionState(organizationId, session.id, { unseenUpdates: true });
    // The run just touched files — refresh the footer git line.
    void (async () => {
      if (!directory) return;
      const result = await readGitStatus(directory.runnerId, directory.cwd);
      if ("error" in result) return;
      const data = roomFrame(sessionRoom(session.id), { type: "gitStatus", ...result });
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

/** Sidebar state for one session, pushed to the org channel. `unseenUpdates` is only sent when it changes; omitted means unchanged. */
export function pushSessionState(organizationId: string, sessionId: string, overrides?: Partial<{ needsInput: boolean; unseenUpdates: boolean }>) {
  const run = activeRuns.get(sessionId);
  const running = run !== undefined;
  const needsInput = overrides?.needsInput ?? (run?.askUser != null);
  broadcastSessionEvent(organizationId, {
    type: "session_state",
    id: sessionId,
    running,
    needsInput,
    ...(overrides?.unseenUpdates !== undefined ? { unseenUpdates: overrides.unseenUpdates } : {}),
  });
}

/** Fan a frame out to every socket currently viewing this session (room members). */
export function broadcastToSession(sessionId: string, frame: unknown) {
  const room = sessionRoom(sessionId);
  const data = roomFrame(room, frame);
  for (const s of sockets) {
    if (!s.rooms.has(room)) continue;
    try {
      s.ws.send(data);
    } catch {
      sockets.delete(s);
    }
  }
}

/** Whether anyone is currently viewing a session (job-completion notices are
 *  only persisted when nobody is watching). */
export function viewersOfSession(sessionId: string): boolean {
  const room = sessionRoom(sessionId);
  for (const s of sockets) if (s.rooms.has(room)) return true;
  return false;
}

/** Direct reply to one socket in a session's room — errors, busy, btw acks.
 * Routed through the room envelope so panels sharing a socket stay separated. */
function replyTo(ws: WSContext, sessionId: string, frame: unknown) {
  try {
    ws.send(roomFrame(sessionRoom(sessionId), frame));
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

async function pushRunners(targets: CodeSocket[]) {
  const orgs = new Set(targets.map((s) => s.organizationId));
  for (const organizationId of orgs) {
    const runners = await runnersForOrg(organizationId);
    const data = JSON.stringify({ type: "runners", runners });
    for (const s of targets) {
      if (s.organizationId !== organizationId) continue;
      try {
        s.ws.send(data);
      } catch {
        // socket gone; cleanup happens in onClose
      }
    }
  }
}

/**
 * One websocket per browser tab (rooms protocol). The org room is implicit —
 * every socket gets sidebar events (session list state) for its organization.
 * Panels subscribe to `session:<id>` rooms as the user opens them; all frames
 * arrive wrapped as {type:"room", room, frame} so a shared socket routes
 * correctly between the main panel and any /btw dialogs.
 */
export function registerCodeWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
  runnerManager.onChange(() => void pushRunners([...sockets]));

  // Resources room: live runner metrics pushed to subscribers of "resources".
  // Org-level routing (the org room is implicit) with its own join message.
  const pushMetrics = (update: { runnerId: string; at: string; metrics: unknown }) => {
    const data = JSON.stringify({ type: "resources", ...update });
    for (const s of sockets) {
      if (s.organizationId !== (orgOfRunner(update.runnerId) ?? "")) continue;
      if (!s.resourcesSubscribed) continue;
      try {
        s.ws.send(data);
      } catch {
        sockets.delete(s);
      }
    }
  };
  let metricsUnsub: (() => void) | null = null;
  const orgOfRunner = (runnerId: string) => runnerManager.orgOf(runnerId);
  const ensureMetricsTap = () => {
    if (!metricsUnsub) {
      metricsUnsub = onMetrics((u) => pushMetrics({ runnerId: u.runnerId, at: u.at, metrics: u.metrics }));
    }
  };

  // Editor websocket tunnel: browser WS ↔ runner WS ↔ code-server on the
  // runner's loopback. Raw WS frames relay as base64 both ways.
  const editorWsTunnel = (prefix: "editor" | "editor-ws") =>
    upgradeWebSocket((c: Context) => {
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);
      const channelId = crypto.randomUUID();
      let opened = false;
      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) return ws.close(4001, "unauthorized");
          const sessionId = c.req.param("id");
          if (!sessionId) return ws.close(4004, "no session");
          const session = await db
            .selectFrom("code_session")
            .select(["codeDirectoryId"])
            .where("id", "=", sessionId)
            .where("organizationId", "=", organizationId)
            .executeTakeFirst();
          if (!session?.codeDirectoryId) return ws.close(4004, "no directory");
          const dir = await db
            .selectFrom("code_directory")
            .select(["runnerId", "cwd"])
            .where("id", "=", session.codeDirectoryId)
            .where("organizationId", "=", organizationId)
            .executeTakeFirst();
          if (!dir) return ws.close(4004, "no directory");
          try {
            const ensured = await runnerManager.editorEnsure(dir.runnerId, dir.cwd);
            if (ensured.error || !ensured.port) return ws.close(1011, ensured.error ?? "editor unavailable");
            const url = new URL(c.req.url);
            const headers: Record<string, string> = {};
            for (const [k, v] of c.req.raw.headers.entries()) {
              // origin: code-server rejects sockets whose Origin isn't its own
              // loopback origin — strip it (we enforce auth at this layer).
              if (["host", "connection", "upgrade", "sec-websocket-key", "sec-websocket-version", "sec-websocket-protocol", "sec-websocket-extensions", "authorization", "origin"].includes(k)) continue;
              headers[k] = v;
            }
            const protocols = (c.req.header("sec-websocket-protocol") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
            // Forward the workbench's own WS path (stable-<commit>/…) + query.
            const wsPath = c.req.path.slice(`/api/code/sessions/${sessionId}/${prefix}`.length) || "/";
            const ok = runnerManager.proxyWsOpen(dir.runnerId, channelId, ws, { port: ensured.port, path: wsPath + url.search, headers, protocols });
            if (!ok) return ws.close(1011, "runner offline");
            opened = true;
            logger.info({ channelId, sessionId, port: ensured.port }, "editor-ws: tunnel requested");
          } catch (e) {
            ws.close(1011, (e as Error).message);
          }
        },
        onMessage(evt: { data: unknown }, _ws: WSContext) {
          if (!opened) return;
          const data = evt.data;
          if (typeof data === "string") runnerManager.proxyWsWrite(channelId, data);
          else if (data instanceof ArrayBuffer) runnerManager.proxyWsWrite(channelId, Buffer.from(data));
          else if (ArrayBuffer.isView(data)) runnerManager.proxyWsWrite(channelId, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
        },
        onClose() {
          runnerManager.proxyWsClose(channelId);
        },
      };
    });

  app.get("/api/code/sessions/:id/editor-ws/*", editorWsTunnel("editor-ws"));
  // The workbench builds its socket path from window.location, so after our
  // path prefix it lands under /editor/ — serve the upgrade there too.
  app.get("/api/code/sessions/:id/editor/*", editorWsTunnel("editor"));

  app.get(
    "/api/code/ws",
    upgradeWebSocket((c: Context) => {
      const orgReady = auth.api
        .getSession({ headers: c.req.raw.headers })
        .then((s) => s?.session.activeOrganizationId ?? null)
        .catch(() => null);

      let socket: CodeSocket | null = null;

      /** State to sync a newly joined session room to. */
      const syncRoom = async (ws: WSContext, sessionId: string) => {
        const run = activeRuns.get(sessionId);
        if (run) {
          run.sockets.add(ws);
          sendRunState(run, ws, sessionId);
        } else {
          // No run in flight — lets clients that missed `done` drop stale transient state.
          try {
            ws.send(roomFrame(sessionRoom(sessionId), { type: "run_state", active: false }));
          } catch {
            // socket gone; cleanup happens in onClose
          }
        }
        // A manual compaction may be running without an agent run — resume
        // the "compacting…" indicator for viewers that just (re)connected.
        if (compactingSessions.has(sessionId)) {
          try {
            ws.send(roomFrame(sessionRoom(sessionId), { type: "compaction_state", active: true }));
          } catch {
            // socket gone; cleanup happens in onClose
          }
        }
        // Live jobs for the session (db-backed; works even for late joiners).
        try {
          const { listJobs } = await import("../lib/background-jobs");
          ws.send(roomFrame(sessionRoom(sessionId), { type: "jobs", jobs: await listJobs(sessionId) }));
        } catch {
          // non-fatal — the panel falls back to the REST list
        }
      };

      return {
        async onOpen(_evt: unknown, ws: WSContext) {
          const organizationId = await orgReady;
          if (!organizationId) {
            ws.close(4401, "unauthorized");
            return;
          }
          socket = { ws, organizationId, rooms: new Set(), resourcesSubscribed: false };
          sockets.add(socket);
          logger.info({ organizationId }, "code ws connected");
          await pushRunners([socket]);
        },

        onClose() {
          if (socket) {
            sockets.delete(socket);
            for (const run of activeRuns.values()) run.sockets.delete(socket.ws);
          }
          logger.info("code ws disconnected");
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

          // Resources room — live runner metrics. Join sends the latest
          // snapshot per (online) runner of the org.
          if (msg.type === "resources:subscribe" || msg.type === "resources:unsubscribe") {
            if (!socket) return;
            if (msg.type === "resources:subscribe") {
              socket.resourcesSubscribed = true;
              ensureMetricsTap();
              for (const live of allLatestMetrics()) {
                if (orgOfRunner(live.runnerId) !== organizationId) continue;
                try {
                  ws.send(JSON.stringify({ type: "resources", runnerId: live.runnerId, at: live.at, metrics: live.metrics }));
                } catch {
                  // socket gone
                }
              }
            } else {
              socket.resourcesSubscribed = false;
            }
            return;
          }

          // Room membership — panels subscribe to the sessions they view.
          if (msg.type === "subscribe" || msg.type === "unsubscribe") {
            const sessionId = typeof msg.session === "string" ? msg.session : "";
            if (!sessionId) return;
            const room = sessionRoom(sessionId);
            if (msg.type === "subscribe") {
              // Join synchronously so a follow-up message (stop/send) in the
              // same burst isn't rejected while the ownership check is in
              // flight; roll back if the check fails.
              socket?.rooms.add(room);
              const owned = await db
                .selectFrom("code_session")
                .select("id")
                .where("id", "=", sessionId)
                .where("organizationId", "=", organizationId)
                .executeTakeFirst();
              if (!owned) {
                socket?.rooms.delete(room);
                replyTo(ws, sessionId, { type: "error", message: "session_not_found" });
                return;
              }
              await syncRoom(ws, sessionId);
            } else {
              socket?.rooms.delete(room);
              activeRuns.get(sessionId)?.sockets.delete(ws);
            }
            return;
          }

          // Seen receipt — the client viewing a session acknowledges its unseen flag.
          // Org-scoped, so no room subscription is required.
          if (msg.type === "seen") {
            const seenId = typeof msg.session === "string" ? msg.session : "";
            if (!seenId) return;
            const updated = await db
              .updateTable("code_session")
              .set({ unseenUpdates: false })
              .where("id", "=", seenId)
              .where("organizationId", "=", organizationId)
              .returning("id")
              .executeTakeFirst();
            if (updated) pushSessionState(organizationId, updated.id, { unseenUpdates: false });
            return;
          }

          // Everything below targets one session room — subscribe first.
          const sessionId = typeof msg.session === "string" ? msg.session : "";
          if (!sessionId) return;
          const room = sessionRoom(sessionId);
          if (!socket?.rooms.has(room)) {
            replyTo(ws, sessionId, { type: "error", message: "not_subscribed" });
            return;
          }

          if (msg.type === "stop") {
            logger.info({ sessionId }, "run stop requested by client");
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
                replyTo(ws, sessionId, { type: "error", message: "connection_and_model_required" });
                return;
              }

              const btw = await db
                .selectFrom("code_session")
                .selectAll()
                .where("id", "=", sessionId)
                .where("organizationId", "=", organizationId)
                .executeTakeFirst();
              if (!btw) {
                replyTo(ws, sessionId, { type: "error", message: "session_not_found" });
                return;
              }
              if (!btw.parentSessionId) {
                replyTo(ws, sessionId, { type: "error", message: "not_a_btw_session" });
                return;
              }
              if (btw.locked) {
                replyTo(ws, sessionId, { type: "error", message: "btw_already_done" });
                return;
              }
              if (activeRuns.has(sessionId)) {
                replyTo(ws, sessionId, { type: "error", message: "btw_run_in_progress" });
                return;
              }

              replyTo(ws, sessionId, { type: "btw_status", text: sendToMain ? "summarizing…" : "closing" });

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
                  replyTo(ws, sessionId, { type: "error", message: "connection_not_found" });
                  return;
                }
                if (!connection.enabled) {
                  replyTo(ws, sessionId, { type: "error", message: "connection_disabled" });
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
                  replyTo(ws, sessionId, { type: "error", message: "btw_summary_failed" });
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
                  if ("error" in started) replyTo(ws, sessionId, { type: "error", message: started.error });
                  else if ("busy" in started) replyTo(ws, sessionId, { type: "error", message: "main_run_in_progress" });
                  else replyTo(ws, sessionId, { type: "btw_done_ok", sendToMain: true });
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
                  replyTo(ws, sessionId, { type: "btw_done_ok", sendToMain: sendToMain && activeRuns.has(main.id) ? null : false });
                }
              } else {
                replyTo(ws, sessionId, { type: "btw_done_ok", sendToMain: false });
              }
              broadcastToSession(btw.id, { type: "session_updated" });
            } catch (e) {
              logger.error({ err: e, sessionId }, "code-ws: btw_done failed");
              try {
                replyTo(ws, sessionId, { type: "error", message: (e as Error).message });
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
              replyTo(ws, sessionId, { type: "error", message: "connection_and_model_required" });
              return;
            }

            const session = await db
              .selectFrom("code_session")
              .selectAll()
              .where("id", "=", sessionId)
              .where("organizationId", "=", organizationId)
              .executeTakeFirst();
            if (!session) {
              replyTo(ws, sessionId, { type: "error", message: "session_not_found" });
              return;
            }

            if (session.locked) {
              replyTo(ws, sessionId, { type: "error", message: "session_locked" });
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
              skills: Array.isArray(msg.skills)
                ? msg.skills.filter((s: unknown) => s && typeof (s as { name?: unknown }).name === "string" && typeof (s as { content?: unknown }).content === "string")
                : [],
            });
            if ("error" in started) {
              replyTo(ws, sessionId, { type: "error", message: started.error });
              return;
            }
            if ("busy" in started) {
              const existingRun = activeRuns.get(session.id);
              if (existingRun) {
                existingRun.sockets.add(ws);
                sendRunState(existingRun, ws, session.id);
              }
              replyTo(ws, sessionId, { type: "busy" });
              return;
            }
            if (await historyWasEmpty(session.id)) broadcastToSession(session.id, { type: "session_updated" });
          } catch (e) {
            logger.error({ err: e, sessionId }, "code-ws: send failed");
            try {
              replyTo(ws, sessionId, { type: "error", message: (e as Error).message });
            } catch {
              // socket gone
            }
          }
        },
      };
    }),
  );
}
