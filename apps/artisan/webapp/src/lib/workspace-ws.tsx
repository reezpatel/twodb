import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { WorkspaceSocket, type ServerFrame } from "./artisan-client.js";

/**
 * One workspace WS at the app level. Views subscribe to frames for the
 * sessions they've joined; joining/leaving is explicit (tabs do it on
 * mount/unmount). Reconnect with replay keeps late viewers in sync.
 */
interface WsState {
  socket: WorkspaceSocket;
  connected: boolean;
  onFrame(listener: (frame: ServerFrame) => void): () => void;
}

const WsContext = createContext<WsState | null>(null);

export function WorkspaceProvider(props: { children: ReactNode }) {
  const socket = useMemo(() => new WorkspaceSocket(), []);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.connect();
    const tick = setInterval(() => setConnected(socket.connected), 1500);
    return () => {
      clearInterval(tick);
    };
  }, [socket]);

  const value = useMemo<WsState>(() => ({
    socket,
    connected,
    onFrame: (l) => socket.onFrame(l),
  }), [socket, connected]);

  return <WsContext.Provider value={value}>{props.children}</WsContext.Provider>;
}

export function useWorkspaceWs(): WsState {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWorkspaceWs must be used inside <WorkspaceProvider>");
  return ctx;
}
