import { useCallback, useEffect, useRef, useState } from "react";
import type { BatchResult, ClientMsg, Op, ServerMsg } from "@shared/model";
import { paintressClient } from "../../lib/paintress-client";
import { newId } from "../../lib/item-store";

export type SocketStatus = "connecting" | "open" | "reconnecting";

export interface SocketHandlers {
  onSnapshot(msg: Extract<ServerMsg, { t: "snapshot" }>): void;
  onEvents(msg: Extract<ServerMsg, { t: "events" }>): void;
  onPresence?(msg: Extract<ServerMsg, { t: "presence" }>): void;
  onError?(code: string, message: string): void;
}

interface Pending {
  resolve(v: unknown): void;
  reject(e: Error): void;
}

/**
 * Business hook: one WebSocket per open board. Reconnects with backoff and
 * resumes from the last seen `seq` (the server replays what was missed, or
 * sends a fresh snapshot when too far behind).
 */
export function useBoardSocket(boardId: string, handlers: SocketHandlers) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const clientId = useRef(newId());
  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef<number | undefined>(undefined);
  const pending = useRef(new Map<string, Pending>());
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(paintressClient.wsUrl(boardId));
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
        const hello: ClientMsg = { t: "hello", clientId: clientId.current, ...(seqRef.current !== undefined ? { since: seqRef.current } : {}) };
        ws.send(JSON.stringify(hello));
        ping = setInterval(() => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ t: "ping" })), 25_000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerMsg;
        switch (msg.t) {
          case "snapshot":
            seqRef.current = msg.seq;
            h.current.onSnapshot(msg);
            break;
          case "events":
            seqRef.current = Math.max(seqRef.current ?? 0, ...msg.events.map((x) => x.seq));
            h.current.onEvents(msg);
            break;
          case "presence":
            h.current.onPresence?.(msg);
            break;
          case "ack":
            pending.current.get(msg.opId)?.resolve(msg.result);
            pending.current.delete(msg.opId);
            break;
          case "docAck":
            pending.current.get(msg.opId)?.resolve({ seq: msg.seq, version: msg.version });
            pending.current.delete(msg.opId);
            break;
          case "error":
            if (msg.opId && pending.current.has(msg.opId)) {
              pending.current.get(msg.opId)!.reject(Object.assign(new Error(msg.message), { code: msg.code }));
              pending.current.delete(msg.opId);
            } else h.current.onError?.(msg.code, msg.message);
            break;
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        for (const p of pending.current.values()) p.reject(new Error("connection lost"));
        pending.current.clear();
        if (closed) return;
        setStatus("reconnecting");
        timer = setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [boardId]);

  const request = useCallback(<T,>(msg: ClientMsg & { opId: string }): Promise<T> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return Promise.reject(new Error("offline"));
    return new Promise<T>((resolve, reject) => {
      pending.current.set(msg.opId, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify(msg));
    });
  }, []);

  const sendOps = useCallback((ops: Op[], label?: string) => request<BatchResult>({ t: "ops", opId: newId(), ops, label }), [request]);
  const sendDoc = useCallback(
    (markdown: string, ifVersion?: number) => request<{ seq: number; version: number }>({ t: "doc", opId: newId(), markdown, ifVersion }),
    [request],
  );
  /** Ask for a fresh snapshot (used after a rejected edit). */
  const resync = useCallback(() => {
    seqRef.current = undefined;
    const ws = wsRef.current;
    if (ws?.readyState === ws?.OPEN) ws?.send(JSON.stringify({ t: "hello", clientId: clientId.current }));
  }, []);

  return { status, clientId: clientId.current, sendOps, sendDoc, resync };
}
