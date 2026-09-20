import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CodeSessionEvent, CodeSessionServerMessage } from "../../shared/api";

const MAX_BACKOFF_MS = 15_000;

const socketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const workspaceId = localStorage.getItem("activeWorkspaceId") ?? "";
  return `${protocol}://${window.location.host}/api/v1/io.twodb.code/ws?workspace=${encodeURIComponent(workspaceId)}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSessionSocket(sessionId: string | null) {
  const [events, setEvents] = useState<CodeSessionEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(sessionId);
  sessionRef.current = sessionId;

  const running = useMemo(() => {
    const active = new Set<string>();
    for (const event of events) {
      if (event.type === "run_started") active.add(event.run_id);
      if (event.type === "run_finished") active.delete(event.run_id);
      if (event.type === "error" && event.run_id) active.delete(event.run_id);
    }
    return active.size > 0;
  }, [events]);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;

    const connect = async () => {
      while (!stopped) {
        socketRef.current?.close();
        await new Promise<void>((resolve) => {
          const socket = new WebSocket(socketUrl());
          socketRef.current = socket;

          socket.onopen = () => {
            attempt = 0;
            setStatus("open");
            subscribedRef.current = null;
            const current = sessionRef.current;
            console.debug(`[code-ws] open — subscribing to ${current ?? "(none)"}`);
            if (current) {
              subscribedRef.current = current;
              socket.send(JSON.stringify({ kind: "subscribe", sessionId: current }));
            }
          };

          socket.onmessage = (message) => {
            let parsed: CodeSessionServerMessage;
            try {
              parsed = JSON.parse(message.data) as CodeSessionServerMessage;
            } catch {
              return;
            }
            if (parsed.kind === "subscribed") {
              setEvents(parsed.snapshot);
            } else if (parsed.kind === "event") {
              setEvents((prev) => [...prev, parsed.event]);
            } else if (parsed.kind === "error") {
              setEvents((prev) => [...prev, { type: "error", run_id: null, error: parsed.message, at: new Date().toISOString() }]);
            }
          };

          socket.onclose = (event) => {
            console.debug(`[code-ws] close code=${event.code} reason=${event.reason || "(none)"} — reconnecting`);
            setStatus("closed");
            subscribedRef.current = null;
            if (event.code === 4003 || event.code === 4002) {
              attempt = 6;
            }
            resolve();
          };

          socket.onerror = () => socket.close();
        });

        if (stopped) break;
        const delay = Math.min(500 * 2 ** attempt++ + Math.random() * 250, MAX_BACKOFF_MS);
        await sleep(delay);
      }
    };

    void connect();
    return () => {
      stopped = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      if (subscribedRef.current && subscribedRef.current !== sessionId) {
        socket.send(JSON.stringify({ kind: "unsubscribe", sessionId: subscribedRef.current }));
      }
      if (sessionId) {
        subscribedRef.current = sessionId;
        setEvents([]);
        socket.send(JSON.stringify({ kind: "subscribe", sessionId }));
      } else if (subscribedRef.current) {
        subscribedRef.current = null;
        setEvents([]);
      }
    } else {
      subscribedRef.current = sessionId;
      setEvents([]);
    }
  }, [sessionId, status]);

  const sendRaw = useCallback((payload: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const send = useCallback(
    (message: string) => {
      if (!sessionId) return;
      sendRaw({ kind: "send", sessionId, message });
    },
    [sessionId, sendRaw],
  );

  const setConnection = useCallback(
    (connectionId: string | null) => {
      if (!sessionId) return;
      sendRaw({ kind: "set_connection", sessionId, connectionId });
    },
    [sessionId, sendRaw],
  );

  const setModel = useCallback(
    (model: string | null) => {
      if (!sessionId) return;
      sendRaw({ kind: "set_model", sessionId, model });
    },
    [sessionId, sendRaw],
  );

  return { events, running, status, send, setConnection, setModel };
}
