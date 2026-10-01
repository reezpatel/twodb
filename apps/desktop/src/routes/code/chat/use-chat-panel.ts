import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CodeMessage, CodeSession } from "../sidenav/use-session-list";
import { api } from "@/lib/api";

export type SessionDetail = CodeSession & {
  messages: CodeMessage[];
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; contextTokens: number };
};

export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  contextTokens: number;
  tokPerSec: number | null;
}

interface StreamFrame {
  type: string;
  active?: boolean;
  round?: number;
  text?: string;
  message?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  stream?: "stdout" | "stderr";
  data?: string;
  output?: string;
  tools?: ToolEvent[];
  status?: string | null;
  thinking?: string;
  thinkingOpen?: boolean;
  stopped?: boolean;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
  contextTokens?: number;
}

export interface ToolEvent {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  output: string;
  done: boolean;
}

export type WsStatus = "connecting" | "open" | "closed";

function wsUrl(sessionId: string) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/api/code/sessions/${sessionId}/ws`;
}

export function useChatPanel(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [liveTools, setLiveTools] = useState<ToolEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("closed");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [thinkingLive, setThinkingLive] = useState(false);
  const [optimistic, setOptimistic] = useState<CodeMessage | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    contextTokens: 0,
    tokPerSec: null,
  });
  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const lastSentRef = useRef("");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);

  const session = useQuery({
    queryKey: ["code", "session", sessionId],
    queryFn: () => api<SessionDetail>(`/api/code/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  const setDirectory = useMutation({
    mutationFn: (codeDirectoryId: string | null) =>
      api(`/api/code/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ codeDirectoryId }),
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["code", "session", sessionId],
      }),
  });

  const invalidateAfterRun = () => {
    void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["llm"] });
  };

  useEffect(() => {
    const u = session.data?.usage;
    if (u) {
      setStats({
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        cachedTokens: u.cachedTokens,
        contextTokens: u.contextTokens,
        tokPerSec: null,
      });
    }
  }, [session.data?.usage]);

  const applyFrame = (frame: StreamFrame) => {
    if (frame.type === "delta") {
      setStreaming((prev) => (prev ?? "") + (frame.text ?? ""));
      const live = liveDeltaRef.current;
      if (live.count === 0) live.startedAt = Date.now();
      live.count += 1;
      const elapsed = Date.now() - live.startedAt;
      if (elapsed > 400) {
        const tokPerSec = Math.round((live.count / elapsed) * 1000 * 10) / 10;
        setStats((prev) => ({ ...prev, tokPerSec }));
      }
    } else if (frame.type === "thinking_start") {
      setThinking("");
      setThinkingLive(true);
    } else if (frame.type === "thinking_delta") {
      setThinking((prev) => (prev ?? "") + (frame.text ?? ""));
    } else if (frame.type === "thinking_end") {
      setThinkingLive(false);
    } else if (frame.type === "round_start") {
      liveDeltaRef.current = { count: 0, startedAt: 0 };
      // Round boundary: everything up to the previous round (incl. tool
      // results) is committed — refetch it and keep only the new round's
      // transient state.
      setRound(frame.round ?? null);
      setStreaming("");
      setLiveTools([]);
      setThinking(null);
      setThinkingLive(false);
      void queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] });
    } else if (frame.type === "round_done" && frame.usage && frame.durationMs) {
      const tokPerSec = frame.usage.outputTokens > 0 ? Math.round((frame.usage.outputTokens / frame.durationMs) * 1000 * 10) / 10 : null;
      setStats((prev) => ({
        inputTokens: prev.inputTokens + frame.usage!.inputTokens,
        outputTokens: prev.outputTokens + frame.usage!.outputTokens,
        cachedTokens: prev.cachedTokens + frame.usage!.cachedTokens,
        contextTokens: frame.usage!.inputTokens + frame.usage!.outputTokens,
        tokPerSec,
      }));
    } else if (frame.type === "tool_start") {
      setLiveTools((prev) => [...prev, { id: frame.id ?? "", name: frame.name ?? "tool", args: frame.args, output: "", done: false }]);
    } else if (frame.type === "tool_output") {
      setLiveTools((prev) => prev.map((t) => (t.id === frame.id ? { ...t, output: t.output + (frame.data ?? "") } : t)));
    } else if (frame.type === "tool_result") {
      setLiveTools((prev) => prev.map((t) => (t.id === frame.id ? { ...t, output: frame.output ?? t.output, done: true } : t)));
    } else if (frame.type === "run_state") {
      if (frame.active === false) {
        // No run in flight — drop stale transient state (the run finished while we were disconnected).
        setStreaming(null);
        setLiveTools([]);
        setStatusText(null);
        setRound(null);
      } else {
        // Resumed a run that was already in progress (reconnect or second viewer).
        setRound(frame.round ?? null);
        setStreaming(frame.text ?? "");
        setLiveTools(frame.tools ?? []);
        setStatusText(frame.status ?? null);
        setThinking(frame.thinking || null);
        setThinkingLive(Boolean(frame.thinkingOpen));
      }
    } else if (frame.type === "busy") {
      // Server rejected the send — a run is already live on this session.
      setOptimistic(null);
      setDraft(lastSentRef.current);
      setError("The agent is already working on this session — your message wasn't sent.");
    } else if (frame.type === "error") {
      setError(frame.message ?? "stream error");
      setOptimistic(null);
      setStatusText(null);
      invalidateAfterRun();
    } else if (frame.type === "status") {
      setStatusText(frame.text ?? null);
    } else if (frame.type === "session_updated") {
      void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
    } else if (frame.type === "done") {
      setStreaming(null);
      setLiveTools([]);
      setOptimistic(null);
      setStatusText(null);
      setRound(null);
      setThinking(null);
      setThinkingLive(false);
      if (frame.usage) {
        setStats((prev) => ({
          ...prev,
          inputTokens: prev.inputTokens,
          contextTokens: frame.contextTokens ?? prev.contextTokens,
        }));
      }
      invalidateAfterRun();
    }
  };

  // Drop the optimistic user message once the committed history contains it.
  useEffect(() => {
    if (!optimistic) return;
    const committed = session.data?.messages ?? [];
    if (committed.some((m) => m.role === "user" && m.content === optimistic.content)) setOptimistic(null);
  }, [session.data, optimistic]);

  useEffect(() => {
    if (!sessionId) {
      setWsStatus("closed");
      return;
    }

    let disposed = false;
    const connect = () => {
      if (disposed) return;
      setWsStatus("connecting");
      const ws = new WebSocket(wsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        // A reconnect may have missed a `done` frame — refresh persisted state.
        if (attemptRef.current > 0) invalidateAfterRun();
        attemptRef.current = 0;
        setWsStatus("open");
        setError(null);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 30_000);
      };

      ws.onmessage = (evt) => {
        try {
          applyFrame(JSON.parse(evt.data as string) as StreamFrame);
        } catch {
          // skip malformed frame
        }
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        if (disposed) return;
        setWsStatus("closed");
        attemptRef.current += 1;
        const delay = Math.min(1000 * 2 ** (attemptRef.current - 1), 15_000);
        retryRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
      setStreaming(null);
      setLiveTools([]);
      setRound(null);
      setThinking(null);
      setThinkingLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const send = (sendConnectionId: string | undefined, sendModel: string | undefined, thinkingLevel?: string) => {
    const content = draft.trim();
    const ws = wsRef.current;
    if (!content || streaming !== null) return;
    if (!sendConnectionId || !sendModel) {
      setError("Pick a connection and model first");
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Chat socket is not connected — retrying…");
      return;
    }

    setError(null);
    setDraft("");
    lastSentRef.current = content;
    setStreaming("");
    setLiveTools([]);
    setStatusText(null);
    setOptimistic({
      id: `optimistic-${Date.now()}`,
      role: "user",
      content,
      meta: null,
      createdAt: new Date().toISOString(),
    });
    ws.send(JSON.stringify({ type: "send", content, connectionId: sendConnectionId, model: sendModel, thinkingLevel }));
  };

  const stop = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || streaming === null) return;
    ws.send(JSON.stringify({ type: "stop" }));
    setStatusText("stopping…");
  };

  return {
    session,
    draft,
    setDraft,
    streaming,
    liveTools,
    error,
    wsStatus,
    statusText,
    round,
    thinking,
    thinkingLive,
    optimistic,
    stats,
    setDirectory,
    send,
    stop,
  };
}
