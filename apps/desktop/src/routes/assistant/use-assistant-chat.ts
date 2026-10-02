import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AssistantArtifact, AssistantMessage } from "./use-assistant-scene";

export interface AssistantStats {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  contextTokens: number;
  tokPerSec: number | null;
}

export interface AssistantChatSeed {
  artifacts: AssistantArtifact[];
  usage: Omit<AssistantStats, "tokPerSec">;
}

export type WsStatus = "connecting" | "open" | "closed";

interface StreamFrame {
  type: string;
  round?: number;
  text?: string;
  message?: string;
  artifact?: AssistantArtifact;
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
  contextTokens?: number;
}

export function useAssistantChat(threadId: string | null, seed?: AssistantChatSeed) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [thinkingLive, setThinkingLive] = useState(false);
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null);
  const [thinkingDurationMs, setThinkingDurationMs] = useState<number | null>(null);
  const thinkingStartRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("closed");
  const [optimistic, setOptimistic] = useState<AssistantMessage | null>(null);
  const [artifacts, setArtifacts] = useState<AssistantArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [stats, setStats] = useState<AssistantStats>({
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    contextTokens: 0,
    tokPerSec: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const seededRef = useRef<{ threadId: string; seeded: boolean }>({ threadId: "", seeded: false });

  const invalidateAfterRun = () => {
    void queryClient.invalidateQueries({ queryKey: ["assistant", "thread", threadId] });
    void queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
    void queryClient.invalidateQueries({ queryKey: ["llm"] });
  };

  const applyFrame = (frame: StreamFrame) => {
    if (frame.type === "delta") {
      setStreaming((prev) => (prev ?? "") + (frame.text ?? ""));
      const live = liveDeltaRef.current;
      if (live.count === 0) live.startedAt = Date.now();
      live.count += 1;
      const elapsed = Date.now() - live.startedAt;
      if (elapsed > 400) {
        setStats((prev) => ({ ...prev, tokPerSec: Math.round((live.count / elapsed) * 10000) / 10 }));
      }
    } else if (frame.type === "thinking_start") {
      setThinking("");
      setThinkingLive(true);
      thinkingStartRef.current = Date.now();
      setThinkingStartedAt(Date.now());
      setThinkingDurationMs(null);
    } else if (frame.type === "thinking_delta") {
      setThinking((prev) => (prev ?? "") + (frame.text ?? ""));
    } else if (frame.type === "thinking_end") {
      setThinkingLive(false);
      setThinkingDurationMs(Date.now() - thinkingStartRef.current);
    } else if (frame.type === "round_start") {
      liveDeltaRef.current = { count: 0, startedAt: 0 };
      thinkingStartRef.current = 0;
      setThinkingStartedAt(null);
      setThinkingDurationMs(null);
    } else if (frame.type === "round_done" && frame.usage && frame.durationMs) {
      const u = frame.usage;
      const tokPerSec = u.outputTokens > 0 ? Math.round((u.outputTokens / frame.durationMs) * 10000) / 10 : null;
      setStats((prev) => ({
        inputTokens: prev.inputTokens + u.inputTokens,
        outputTokens: prev.outputTokens + u.outputTokens,
        cachedTokens: prev.cachedTokens + u.cachedTokens,
        contextTokens: u.inputTokens + u.outputTokens,
        tokPerSec,
      }));
    } else if (frame.type === "canvas" && frame.artifact) {
      const artifact = frame.artifact;
      setArtifacts((prev) => [artifact, ...prev.filter((a) => a.id !== artifact.id)]);
      setActiveArtifactId(artifact.id);
    } else if (frame.type === "error") {
      setError(frame.message ?? "stream error");
      setOptimistic(null);
      setStreaming(null);
      invalidateAfterRun();
    } else if (frame.type === "thread_updated") {
      void queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
    } else if (frame.type === "done") {
      setStreaming(null);
      setOptimistic(null);
      setThinking(null);
      if (frame.usage) {
        setStats((prev) => ({ ...prev, contextTokens: frame.contextTokens ?? prev.contextTokens }));
      }
      invalidateAfterRun();
    }
  };

  // seed stats + artifacts from the thread detail once per thread (live frames take over after)
  useEffect(() => {
    if (!threadId) return;
    if (seededRef.current.threadId !== threadId) {
      seededRef.current = { threadId, seeded: false };
      setArtifacts([]);
      setActiveArtifactId(null);
      setStats({ inputTokens: 0, outputTokens: 0, cachedTokens: 0, contextTokens: 0, tokPerSec: null });
    }
    if (!seededRef.current.seeded && seed) {
      seededRef.current.seeded = true;
      setStats((prev) => ({ ...prev, ...seed.usage }));
      setArtifacts(seed.artifacts);
      setActiveArtifactId(seed.artifacts[0]?.id ?? null);
    }
  }, [threadId, seed]);

  useEffect(() => {
    if (!threadId) {
      setWsStatus("closed");
      return;
    }

    let disposed = false;
    const connect = () => {
      if (disposed) return;
      setWsStatus("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/assistant/threads/${threadId}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const send = (connectionId: string | undefined, model: string | undefined, thinkingLevel?: string, contentOverride?: string): boolean => {
    const content = (contentOverride ?? draft).trim();
    const ws = wsRef.current;
    if (!content || streaming !== null) return false;
    if (!connectionId || !model) {
      setError("Pick a connection and model first");
      return false;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("Chat socket is not connected — retrying…");
      return false;
    }

    setError(null);
    setDraft("");
    setStreaming("");
    setOptimistic({
      id: `optimistic-${Date.now()}`,
      role: "user",
      content,
      meta: null,
      createdAt: new Date().toISOString(),
    });
    ws.send(JSON.stringify({ type: "send", content, connectionId, model, ...(thinkingLevel ? { thinkingLevel } : {}) }));
    return true;
  };

  const activeArtifact = artifacts.find((a) => a.id === activeArtifactId) ?? artifacts[0] ?? null;

  return {
    draft,
    setDraft,
    streaming,
    thinking,
    thinkingLive,
    thinkingStartedAt,
    thinkingDurationMs,
    error,
    wsStatus,
    optimistic,
    stats,
    artifacts,
    activeArtifact,
    setActiveArtifactId,
    send,
  };
}
