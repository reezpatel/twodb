import { useEffect } from "react";
import { wsUrl } from "./native";

// Client half of the /api/ws room gateway. One socket per app, opened lazily
// by <GatewayProvider>; notifications are implicit rooms, so no join is
// needed — subscribe() just filters delivered frames by event name.

export interface GatewayFrame {
  v: number;
  room?: string;
  event?: string;
  op?: string;
  data?: unknown;
}

type Listener = (data: unknown) => void;

interface GatewayState {
  ws: WebSocket | null;
  listeners: Map<string, Set<Listener>>;
  connected: boolean;
  retry: number;
}

const state: GatewayState = { ws: null, listeners: new Map(), connected: false, retry: 1000 };
let connecting = false;

function dispatch(frame: GatewayFrame) {
  if (!frame.event) return;
  const set = state.listeners.get(frame.event);
  if (set) for (const fn of set) fn(frame.data);
}

function connect() {
  if (state.ws || connecting) return;
  connecting = true;
  const ws = new WebSocket(wsUrl("/api/ws"));
  state.ws = ws;
  let ping: ReturnType<typeof setInterval> | null = null;

  ws.onopen = () => {
    connecting = false;
    state.connected = true;
    state.retry = 1000;
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ v: 1, op: "ping" })), 25_000);
  };
  ws.onmessage = (evt) => {
    try {
      dispatch(JSON.parse(String(evt.data)) as GatewayFrame);
    } catch {
      // ignore malformed frames
    }
  };
  ws.onclose = () => {
    if (ping) clearInterval(ping);
    connecting = false;
    state.connected = false;
    state.ws = null;
    setTimeout(connect, (state.retry = Math.min(state.retry * 2, 30_000)));
  };
  ws.onerror = () => ws.close();
}

/** Subscribe to gateway events by name (e.g. "notification.new"). */
export function subscribeToGateway(event: string, listener: Listener): () => void {
  let set = state.listeners.get(event);
  if (!set) {
    set = new Set();
    state.listeners.set(event, set);
  }
  set.add(listener);
  connect();
  return () => {
    set.delete(listener);
    if (!set.size) state.listeners.delete(event);
  };
}

export function useGatewayEvent(event: string, handler: (data: unknown) => void) {
  useEffect(() => subscribeToGateway(event, handler), [event, handler]);
}
