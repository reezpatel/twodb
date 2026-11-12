import { useEffect, useRef } from "react";
import type { Message, Notification, ReactionSummary } from "./chat-client";

/**
 * Live chat socket through the gateway (/apps/twochat/ws — bridged by the
 * gateway's ws-passthrough). Auto-reconnects with backoff; frames mirror the
 * server's ServerFrame union (src/ws/hub.ts on the backend).
 */export type ServerFrame =
  | { type: "hello"; userId: string | null }
  | { type: "message"; channelId: string; message: Message }
  | { type: "message_edited"; channelId: string; message: Message }
  | { type: "message_deleted"; channelId: string; messageId: string }
  | { type: "reaction"; channelId: string; messageId: string; reactions: ReactionSummary[] }
  | { type: "pin"; channelId: string; messageId: string; pinned: boolean }
  | { type: "typing"; channelId: string; actor: { type: "user" | "bot"; id: string; name: string } }
  | { type: "presence"; online: Array<{ type: "user" | "bot"; id: string }> }
  | { type: "read"; channelId: string; userId: string; messageId: string | null }
  | { type: "channel_created"; channel: unknown }
  | { type: "channel_updated"; channel: unknown }
  | { type: "channel_deleted"; id: string }
  | { type: "notification"; notification: Notification };

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface ChatSocketHandlers {
  onFrame?: (frame: ServerFrame) => void;
  onStatus?: (status: ConnectionStatus) => void;
}

/**
 * Socket holder: exposes send() bound to the live socket so components can
 * push typing/read frames without re-subscribing on every render.
 */
export function useChatSocketRef(enabled: boolean, handlers: ChatSocketHandlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let retryMs = 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      handlersRef.current.onStatus?.("connecting");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      // Dev: vite proxies /apps/twochat/ws → gateway (ws: true). The gateway
      // bridges to the app after resolving the session. In prod both run at
      // the gateway origin, so the same path works.
      const ws = new WebSocket(`${proto}://${window.location.host}/apps/twochat/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryMs = 1000;
        handlersRef.current.onStatus?.("open");
      };
      ws.onmessage = (evt) => {
        try {
          handlersRef.current.onFrame?.(JSON.parse(String(evt.data)) as ServerFrame);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        handlersRef.current.onStatus?.("closed");
        wsRef.current = null;
        if (!closed) {
          timer = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 15000);
        }
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [enabled]);

  const send = (frame: Record<string, unknown>): void => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  };

  return send;
}
