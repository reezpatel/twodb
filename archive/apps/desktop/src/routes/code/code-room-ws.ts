import { wsUrl } from "@/lib/native";

/**
 * One websocket per browser tab for all of apps/code (rooms protocol).
 *
 * The server exposes a single endpoint, `/api/code/ws`. The org room is
 * implicit (auth); panels `join("session:<id>")` to receive that session's
 * stream frames, wrapped as `{type:"room", room, frame}`. Org-level frames
 * (sidebar session list events, runner list) arrive unwrapped.
 *
 * The socket is refcounted: the first consumer opens it, the last out closes
 * it. Handlers are keyed by room; reconnects resubscribe every joined room and
 * replay a `run_state` sync so panels recover live runs seamlessly.
 */

type OrgFrame = { type: string; [k: string]: unknown };
type RoomHandler = (frame: unknown) => void;
type OrgHandler = (frame: OrgFrame) => void;

interface RoomEntry {
  ref: number;
  handlers: Set<RoomHandler>;
}

const PING_INTERVAL = 30_000;

let ws: WebSocket | null = null;
let refTotal = 0;
let statusListeners = new Set<(s: "connecting" | "open" | "closed") => void>();
let orgHandlers = new Set<OrgHandler>();
let rooms = new Map<string, RoomEntry>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let wantOpen = false;
const pendingSeen = new Set<string>();

function connect() {
  if (!wantOpen || ws) return;
  statusListeners.forEach((fn) => fn("connecting"));
  const sock = new WebSocket(wsUrl("/api/code/ws"));
  ws = sock;

  sock.onopen = () => {
    if (ws !== sock) return;
    attempt = 0;
    statusListeners.forEach((fn) => fn("open"));
    // (Re)subscribe every joined room — the server replies with run_state /
    // compaction_state / jobs sync per room, which panels use to recover.
    for (const room of rooms.keys()) sock.send(JSON.stringify({ type: "subscribe", session: room.slice("session:".length) }));
    if (resourcesRefCount > 0) sock.send(JSON.stringify({ type: "resources:subscribe" }));
    for (const id of pendingSeen) sock.send(JSON.stringify({ type: "seen", session: id }));
    pendingSeen.clear();
    pingTimer = setInterval(() => {
      if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ type: "ping" }));
    }, PING_INTERVAL);
  };

  sock.onmessage = (evt) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(evt.data as string);
    } catch {
      return;
    }
    const frame = parsed as { type?: string; room?: string; frame?: unknown; runnerId?: string; metrics?: unknown; at?: string; [k: string]: unknown };
    if (frame?.type === "room" && typeof frame.room === "string") {
      const entry = rooms.get(frame.room);
      if (entry) entry.handlers.forEach((h) => h(frame.frame));
    } else if (frame?.type === "resources") {
      dispatchResources({ runnerId: frame.runnerId ?? "", at: frame.at ?? "", metrics: frame.metrics });
      orgHandlers.forEach((h) => h(frame as OrgFrame));
    } else {
      orgHandlers.forEach((h) => h(frame as OrgFrame));
    }
  };

  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    statusListeners.forEach((fn) => fn("closed"));
    if (!wantOpen) return;
    attempt += 1;
    retryTimer = setTimeout(connect, Math.min(1000 * 2 ** (attempt - 1), 15_000));
  };
}

function ensureOpen() {
  wantOpen = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!ws) connect();
}

function maybeClose() {
  if (refTotal > 0 || rooms.size > 0 || resourcesRefCount > 0) return;
  wantOpen = false;
  if (retryTimer) clearTimeout(retryTimer);
  if (pingTimer) clearInterval(pingTimer);
  retryTimer = null;
  pingTimer = null;
  ws?.close();
  ws = null;
}

/** Subscribe to one session's stream. Returns an unsubscribe fn. */
export function joinSessionRoom(sessionId: string, onFrame: RoomHandler): () => void {
  const room = `session:${sessionId}`;
  let entry = rooms.get(room);
  if (!entry) {
    entry = { ref: 0, handlers: new Set() };
    rooms.set(room, entry);
  }
  entry.ref += 1;
  entry.handlers.add(onFrame);
  refTotal += 1;
  ensureOpen();
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "subscribe", session: sessionId }));
  return () => {
    const cur = rooms.get(room);
    if (!cur) return;
    cur.handlers.delete(onFrame);
    cur.ref -= 1;
    refTotal -= 1;
    if (cur.ref <= 0) {
      rooms.delete(room);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "unsubscribe", session: sessionId }));
    }
    maybeClose();
  };
}

/** Seen receipt: clears the session's unseen flag on the server. Queued until the socket is open. */
export function markSessionSeen(sessionId: string) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "seen", session: sessionId }));
  else pendingSeen.add(sessionId);
}

/** Listen to org-level frames (sidebar events, runners). Returns an unsubscribe fn. */
export function onOrgFrames(handler: OrgHandler): () => void {
  orgHandlers.add(handler);
  refTotal += 1;
  ensureOpen();
  return () => {
    orgHandlers.delete(handler);
    refTotal -= 1;
    maybeClose();
  };
}

/** Connection status — the composer disables sends while closed. */
export function onWsStatus(fn: (s: "connecting" | "open" | "closed") => void): () => void {
  statusListeners.add(fn);
  fn(ws?.readyState === WebSocket.OPEN ? "open" : ws ? "connecting" : "closed");
  return () => statusListeners.delete(fn);
}

/** Current connection status (poll-style). */
export function getWsStatus(): "connecting" | "open" | "closed" {
  return ws?.readyState === WebSocket.OPEN ? "open" : ws ? "connecting" : "closed";
}

/** Send a message to a session's room (send / stop / ask_user_response / btw_done). */
export function sendToSession(sessionId: string, message: Record<string, unknown>): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify({ ...message, session: sessionId }));
  return true;
}

// --- resources room -----------------------------------------------------------

type ResourcesHandler = (frame: { runnerId: string; at: string; metrics: unknown }) => void;
let resourcesHandlers = new Set<ResourcesHandler>();
let resourcesRefCount = 0;

/** Subscribe to live runner metrics (resources room on the shared socket). */
export function subscribeResources(onFrame?: ResourcesHandler): () => void {
  if (onFrame) resourcesHandlers.add(onFrame);
  resourcesRefCount += 1;
  ensureOpen();
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resources:subscribe" }));
  return () => {
    if (onFrame) resourcesHandlers.delete(onFrame);
    resourcesRefCount -= 1;
    if (resourcesRefCount <= 0) {
      resourcesRefCount = 0;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resources:unsubscribe" }));
    }
  };
}

/** Dispatch hook for the onmessage router (below). */
function dispatchResources(frame: { runnerId: string; at: string; metrics: unknown }) {
  for (const h of resourcesHandlers) h(frame);
}
